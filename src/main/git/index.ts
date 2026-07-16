import { ipcMain, type BrowserWindow } from 'electron';
import { IpcChannels } from '../../shared/ipc';
import type {
  GitAutoCommitMode,
  GitBackupStatus,
  GitPushResult,
  GitRemoteConfig,
  GitRemoteSetupInput,
  GitRemoteSetupResult,
  GitRepoNameCheck,
  GitSettings,
  GitVisibility,
} from '../../shared/git';
import { clampIntervalMinutes, isValidRemoteUrl, validateRepoName } from '../../shared/git';
import { readSettings, setGitSettings } from '../settings';
import type { NotesService } from '../storage/notesService';
import { GitService } from './service';

const COMMIT_DEBOUNCE_MS = 2000;

function assertString(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new Error(`Expected ${name} to be a string`);
  return value;
}

function assertBoolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Expected ${name} to be a boolean`);
  return value;
}

function isAutoCommitMode(value: unknown): value is GitAutoCommitMode {
  return value === 'onSave' || value === 'interval' || value === 'manual';
}

function isVisibility(value: unknown): value is GitVisibility {
  return value === 'private' || value === 'public' || value === 'internal';
}

/** Validate the untrusted remote-setup payload coming from the renderer. */
function validateSetupInput(value: unknown): GitRemoteSetupInput {
  if (typeof value !== 'object' || value === null) throw new Error('Invalid remote setup input');
  const v = value as Record<string, unknown>;
  const mode = v['mode'];
  if (mode !== 'gh' && mode !== 'url') throw new Error('Invalid remote mode');
  const autoPush = assertBoolean(v['autoPush'], 'autoPush');
  const input: GitRemoteSetupInput = { mode, autoPush };
  if (mode === 'url') {
    const remoteUrl = assertString(v['remoteUrl'], 'remoteUrl');
    if (!isValidRemoteUrl(remoteUrl)) throw new Error('Enter a valid HTTPS or SSH git remote URL.');
    input.remoteUrl = remoteUrl;
    return input;
  }
  const ghAction = v['ghAction'];
  if (ghAction !== 'create' && ghAction !== 'existing') throw new Error('Invalid gh action');
  input.ghAction = ghAction;
  if (typeof v['host'] === 'string' && v['host'].length > 0) input.host = v['host'];
  input.owner = assertString(v['owner'], 'owner');
  const repo = validateRepoName(assertString(v['repo'], 'repo'));
  if (!repo.valid) throw new Error(repo.error ?? 'Invalid repository name.');
  input.repo = repo.normalized;
  if (v['visibility'] !== undefined) {
    if (!isVisibility(v['visibility'])) throw new Error('Invalid visibility');
    input.visibility = v['visibility'];
  }
  if (v['acknowledgePublic'] !== undefined) {
    input.acknowledgePublic = assertBoolean(v['acknowledgePublic'], 'acknowledgePublic');
  }
  return input;
}

/**
 * Coordinates the git {@link GitService}, persisted settings, autosave-driven
 * commit scheduling, and status broadcasts. This is the single owner of the
 * backup lifecycle in the main process.
 */
export class GitBackup {
  private readonly service: GitService;
  private window: BrowserWindow | undefined;
  private commitTimer: NodeJS.Timeout | undefined;
  private intervalTimer: NodeJS.Timeout | undefined;
  private pendingTitles = new Set<string>();

  constructor(
    vaultDir: string,
    private readonly notes: NotesService,
  ) {
    this.service = new GitService(vaultDir);
  }

  setWindow(window: BrowserWindow): void {
    this.window = window;
  }

  private gitSettings(): GitSettings {
    return readSettings().git;
  }

  /** Apply the effect of the current settings to the mutation listener + timers. */
  private applyScheduling(): void {
    const git = this.gitSettings();
    if (git.enabled) {
      this.notes.setMutationListener((titles) => this.onMutation(titles));
    } else {
      this.notes.setMutationListener(undefined);
    }
    this.configureInterval(git);
  }

  private configureInterval(git: GitSettings): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = undefined;
    }
    if (!git.enabled || git.autoCommit !== 'interval') return;
    const minutes = clampIntervalMinutes(git.intervalMinutes);
    this.intervalTimer = setInterval(() => {
      void this.commitAndMaybePush();
    }, minutes * 60_000);
  }

  private onMutation(titles: string[]): void {
    for (const title of titles) this.pendingTitles.add(title);
    const git = this.gitSettings();
    if (!git.enabled || git.autoCommit !== 'onSave') return;
    if (this.commitTimer) clearTimeout(this.commitTimer);
    this.commitTimer = setTimeout(() => {
      void this.commitAndMaybePush();
    }, COMMIT_DEBOUNCE_MS);
  }

  private takeTitles(): string[] {
    const titles = [...this.pendingTitles];
    this.pendingTitles.clear();
    return titles;
  }

  /** Commit pending changes and push when auto-push is on, then broadcast status. */
  private async commitAndMaybePush(): Promise<void> {
    const git = this.gitSettings();
    if (!git.enabled) return;
    const titles = this.takeTitles();
    try {
      const result = await this.service.commit(titles);
      if (result.committed && git.remote?.autoPush) {
        const push = await this.service.pushNow();
        if (push.state === 'clean') this.persistLastPush();
      }
    } catch {
      // Backup failures must never interrupt note-taking; surfaced via status.
    }
    await this.broadcastStatus();
  }

  private persistLastPush(): void {
    const git = this.gitSettings();
    setGitSettings({ ...git, lastPushAt: new Date().toISOString() });
  }

  private async currentStatus(): Promise<GitBackupStatus> {
    return this.service.status(this.gitSettings());
  }

  private async broadcastStatus(): Promise<GitBackupStatus> {
    const status = await this.currentStatus();
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(IpcChannels.gitStatusChanged, status);
    }
    return status;
  }

  /** Register all backup IPC handlers and start scheduling from current settings. */
  registerHandlers(): void {
    this.applyScheduling();

    ipcMain.handle(IpcChannels.gitGetStatus, () => this.currentStatus());

    ipcMain.handle(IpcChannels.gitSetEnabled, async (_e, enabled: unknown) => {
      const on = assertBoolean(enabled, 'enabled');
      const git = this.gitSettings();
      if (on && !git.enabled) {
        await this.service.initialize();
        setGitSettings({ ...git, enabled: true });
      } else if (!on && git.enabled) {
        setGitSettings({ ...git, enabled: false });
      }
      this.applyScheduling();
      return this.broadcastStatus();
    });

    ipcMain.handle(IpcChannels.gitSetAutoCommit, (_e, mode: unknown, intervalMinutes: unknown) => {
      if (!isAutoCommitMode(mode)) throw new Error('Invalid auto-commit mode');
      const git = this.gitSettings();
      const next: GitSettings = { ...git, autoCommit: mode };
      if (
        mode === 'interval' &&
        typeof intervalMinutes === 'number' &&
        Number.isFinite(intervalMinutes)
      ) {
        next.intervalMinutes = clampIntervalMinutes(intervalMinutes);
      }
      setGitSettings(next);
      this.applyScheduling();
      return this.broadcastStatus();
    });

    ipcMain.handle(IpcChannels.gitSetAutoPush, (_e, enabled: unknown) => {
      const on = assertBoolean(enabled, 'enabled');
      const git = this.gitSettings();
      if (!git.remote) throw new Error('Configure a backup remote before enabling auto-push.');
      const remote: GitRemoteConfig = { ...git.remote, autoPush: on };
      setGitSettings({ ...git, remote });
      return this.broadcastStatus();
    });

    ipcMain.handle(IpcChannels.gitGetDestinations, () => this.service.destinations());

    ipcMain.handle(
      IpcChannels.gitCheckRepoName,
      async (_e, host: unknown, owner: unknown, name: unknown): Promise<GitRepoNameCheck> => {
        const hostArg = typeof host === 'string' && host.length > 0 ? host : undefined;
        return this.service.checkRepoName(
          hostArg,
          assertString(owner, 'owner'),
          assertString(name, 'name'),
        );
      },
    );

    ipcMain.handle(
      IpcChannels.gitSetupRemote,
      async (_e, input: unknown): Promise<GitRemoteSetupResult> => {
        const setup = validateSetupInput(input);
        const git = this.gitSettings();
        if (!git.enabled) throw new Error('Enable version history before configuring a remote.');
        const result = await this.service.setupRemote(setup);
        const next: GitSettings = { ...git, remote: result.remote };
        if (result.pushState === 'clean') next.lastPushAt = new Date().toISOString();
        setGitSettings(next);
        const status = await this.broadcastStatus();
        return {
          pushState: result.pushState,
          ...(result.detail ? { detail: result.detail } : {}),
          status,
        };
      },
    );

    ipcMain.handle(IpcChannels.gitRemoveRemote, async () => {
      await this.service.removeRemote();
      const git = this.gitSettings();
      const next: GitSettings = {
        enabled: git.enabled,
        autoCommit: git.autoCommit,
        intervalMinutes: git.intervalMinutes,
      };
      setGitSettings(next);
      return this.broadcastStatus();
    });

    ipcMain.handle(IpcChannels.gitPushNow, async (): Promise<GitPushResult> => {
      const push = await this.service.pushNow();
      if (push.state === 'clean') this.persistLastPush();
      const status = await this.broadcastStatus();
      return { state: push.state, ...(push.detail ? { detail: push.detail } : {}), status };
    });
  }

  /**
   * Quit barrier: flush any pending debounced commit, then drain the queue so a
   * commit/push in flight completes before the app tears down (research R3 §4.4).
   */
  async flushForQuit(): Promise<void> {
    if (this.commitTimer) {
      clearTimeout(this.commitTimer);
      this.commitTimer = undefined;
    }
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = undefined;
    }
    if (!this.gitSettings().enabled) return;
    try {
      await this.commitAndMaybePush();
    } catch {
      // Best-effort on shutdown.
    }
    await this.service.drain();
  }
}
