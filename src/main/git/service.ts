import { existsSync, readdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  GitBackupStatus,
  GitDestinations,
  GitRemoteConfig,
  GitSettings,
  GitSyncState,
  GitVisibility,
} from '../../shared/git';
import { isValidRemoteUrl, validateRepoName } from '../../shared/git';
import { classifyPushFailure } from './classify';
import { autoCommitMessage } from './message';
import { countAhead, isDirty, preflight } from './preflight';
import {
  createRepo,
  discoverDestinations,
  readVisibility,
  repoExists,
  resolveRemoteUrl,
} from './provision';
import { GitOpQueue } from './queue';
import { resolveBinary, runGit } from './runner';

const GITIGNORE = ['.DS_Store', 'index.sqlite', '*.tmp-*', ''].join('\n');
const GITATTRIBUTES = ['*.md text eol=lf', ''].join('\n');
const IDENTITY_NAME = 'Inkwell';
const IDENTITY_EMAIL = 'inkwell@localhost';

export interface CommitResult {
  committed: boolean;
}

export interface RemoteSetupResult {
  remote: GitRemoteConfig;
  pushState: GitSyncState;
  detail?: string;
}

/**
 * Orchestrates all git operations for the vault: local history, remote setup,
 * and one-way pushes. Every worktree-touching call is serialized through a
 * single {@link GitOpQueue} so operations never overlap (research R3 §2.3).
 */
export class GitService {
  private readonly queue = new GitOpQueue();
  private gitBin: string | undefined;
  private gitResolved = false;

  constructor(private readonly vaultDir: string) {}

  private async git(): Promise<string> {
    if (!this.gitResolved) {
      this.gitBin = await resolveBinary('git');
      this.gitResolved = true;
    }
    if (!this.gitBin) throw new Error('The `git` command was not found.');
    return this.gitBin;
  }

  async gitAvailable(): Promise<boolean> {
    try {
      await this.git();
      return true;
    } catch {
      return false;
    }
  }

  async ghAvailable(): Promise<boolean> {
    return (await resolveBinary('gh')) !== undefined;
  }

  private async ensureIdentity(gitBin: string): Promise<void> {
    const email = await runGit(gitBin, this.vaultDir, ['config', 'user.email'], {
      allowNonZero: true,
    });
    if (email.code === 0 && email.stdout.trim().length > 0) return;
    await runGit(gitBin, this.vaultDir, ['config', 'user.email', IDENTITY_EMAIL]);
    await runGit(gitBin, this.vaultDir, ['config', 'user.name', IDENTITY_NAME]);
  }

  /** Initialize a git repo in the vault (idempotent) and make the first commit. */
  async initialize(): Promise<void> {
    return this.queue.runExclusive(async () => {
      const gitBin = await this.git();
      const state = await preflight(gitBin, this.vaultDir);
      if (state.kind === 'foreign-repo') {
        throw new Error(
          `The vault is inside another git repository (${state.root}). Move it to its own folder to enable backup.`,
        );
      }
      if (state.kind === 'not-a-repo') {
        await runGit(gitBin, this.vaultDir, ['init', '-b', 'main']);
      }
      await this.ensureIdentity(gitBin);

      const gitignore = join(this.vaultDir, '.gitignore');
      if (!existsSync(gitignore)) await writeFile(gitignore, GITIGNORE, 'utf8');
      const gitattributes = join(this.vaultDir, '.gitattributes');
      if (!existsSync(gitattributes)) await writeFile(gitattributes, GITATTRIBUTES, 'utf8');

      await this.commitInternal(gitBin, { message: 'Initialize Inkwell vault backup' });
    });
  }

  private stagePathspecs(): string[] {
    const specs: string[] = [];
    // Only include the markdown pathspec when at least one note exists: git aborts
    // the entire `add` with a fatal error on a pathspec that matches nothing
    // (e.g. the first commit of an empty vault), which would strand the git meta
    // files. RD-11 still holds — we never fall back to a blanket `git add -A`.
    // Match `.md` case-insensitively to stay consistent with vault scanning, and
    // use an icase pathspec so files like `NOTE.MD` are staged too.
    let hasMarkdown = false;
    try {
      hasMarkdown = readdirSync(this.vaultDir).some((name) => name.toLowerCase().endsWith('.md'));
    } catch {
      hasMarkdown = false;
    }
    if (hasMarkdown) specs.push(':(icase)*.md');
    if (existsSync(join(this.vaultDir, '.gitignore'))) specs.push('.gitignore');
    if (existsSync(join(this.vaultDir, '.gitattributes'))) specs.push('.gitattributes');
    return specs;
  }

  private async commitInternal(
    gitBin: string,
    opts: { message?: string; titles?: readonly string[] },
  ): Promise<CommitResult> {
    // Stage only managed markdown notes plus git meta files — never `git add -A`
    // (research R3 §3.2, RD-11).
    const specs = this.stagePathspecs();
    if (specs.length > 0) {
      await runGit(gitBin, this.vaultDir, ['add', '--all', '--', ...specs], {
        allowNonZero: true,
      });
    }
    const message = opts.message ?? autoCommitMessage(opts.titles ?? []);
    const result = await runGit(gitBin, this.vaultDir, ['commit', '-m', message], {
      allowNonZero: true,
    });
    if (result.code === 0) return { committed: true };
    // No staged changes is the expected no-op path (wording varies by git version).
    if (
      /nothing to commit|nothing added to commit|no changes added/i.test(
        `${result.stdout}${result.stderr}`,
      )
    ) {
      return { committed: false };
    }
    throw new Error(result.stderr.trim() || 'Could not commit changes.');
  }

  /** Commit any pending note changes. Serialized; a no-op when nothing changed. */
  async commit(titles: readonly string[] = []): Promise<CommitResult> {
    return this.queue.runExclusive(async () => {
      const gitBin = await this.git();
      const state = await preflight(gitBin, this.vaultDir);
      if (state.kind === 'not-a-repo' || state.kind === 'foreign-repo') {
        return { committed: false };
      }
      return this.commitInternal(gitBin, { titles });
    });
  }

  async destinations(): Promise<GitDestinations> {
    const ghBin = await resolveBinary('gh');
    if (!ghBin) return { hosts: ['github.com'], owners: [], orgOwners: [] };
    return discoverDestinations(ghBin);
  }

  /** Check whether a repository name is available under an owner. */
  async checkRepoName(
    host: string | undefined,
    owner: string,
    name: string,
  ): Promise<{ available: boolean; normalized: string; error?: string }> {
    const validation = validateRepoName(name);
    if (!validation.valid) {
      return { available: false, normalized: validation.normalized, error: validation.error };
    }
    const ghBin = await resolveBinary('gh');
    if (!ghBin) return { available: true, normalized: validation.normalized };
    const exists = await repoExists(ghBin, host, owner, validation.normalized);
    return {
      available: !exists,
      normalized: validation.normalized,
      ...(exists ? { error: 'A repository with that name already exists.' } : {}),
    };
  }

  private async setOrigin(gitBin: string, url: string): Promise<void> {
    const current = await runGit(gitBin, this.vaultDir, ['remote', 'get-url', 'origin'], {
      allowNonZero: true,
    });
    if (current.code === 0) {
      await runGit(gitBin, this.vaultDir, ['remote', 'set-url', 'origin', url]);
    } else {
      await runGit(gitBin, this.vaultDir, ['remote', 'add', 'origin', url]);
    }
  }

  private async pushInternal(
    gitBin: string,
    branch: string,
  ): Promise<{ state: GitSyncState; detail?: string }> {
    const result = await runGit(gitBin, this.vaultDir, ['push', '-u', 'origin', branch], {
      allowNonZero: true,
      timeoutMs: 120_000,
    });
    if (result.code === 0) return { state: 'clean' };
    const state = classifyPushFailure(result.stderr);
    return { state, detail: result.stderr.trim() };
  }

  /**
   * Provision/attach the backup remote and perform the first push. API-only
   * repo creation, then hardened-runner remote wiring + push (research R3 §4.1).
   */
  async setupRemote(input: {
    mode: 'gh' | 'url';
    ghAction?: 'create' | 'existing';
    host?: string;
    owner?: string;
    repo?: string;
    visibility?: GitVisibility;
    remoteUrl?: string;
    autoPush: boolean;
    acknowledgePublic?: boolean;
  }): Promise<RemoteSetupResult> {
    return this.queue.runExclusive(async () => {
      const gitBin = await this.git();
      const state = await preflight(gitBin, this.vaultDir);
      if (state.kind === 'foreign-repo' || state.kind === 'not-a-repo') {
        throw new Error('Enable version history before configuring a remote.');
      }
      if (state.kind === 'blocked') {
        throw new Error(state.reason);
      }
      const branch = state.branch;

      let remote: GitRemoteConfig;

      if (input.mode === 'url') {
        const url = (input.remoteUrl ?? '').trim();
        if (!isValidRemoteUrl(url)) {
          throw new Error('Enter a valid HTTPS or SSH git remote URL.');
        }
        remote = {
          mode: 'url',
          host: '',
          owner: '',
          repo: '',
          visibility: 'unknown',
          remoteUrl: url,
          autoPush: input.autoPush,
        };
      } else {
        const ghBin = await resolveBinary('gh');
        if (!ghBin)
          throw new Error('GitHub CLI (`gh`) is required to create or attach a repository.');
        const owner = input.owner?.trim();
        const host = input.host?.trim() || 'github.com';
        if (!owner) throw new Error('Choose an owner for the repository.');
        const validation = validateRepoName(input.repo ?? '');
        if (!validation.valid) throw new Error(validation.error ?? 'Invalid repository name.');
        const repo = validation.normalized;
        const visibility = input.visibility ?? 'private';
        if (visibility === 'public' && input.acknowledgePublic !== true) {
          throw new Error('Confirm that the repository will be public before continuing.');
        }

        if (input.ghAction === 'existing') {
          if (!(await repoExists(ghBin, host, owner, repo))) {
            throw new Error('That repository does not exist under the chosen owner.');
          }
        } else {
          await createRepo(ghBin, { host, owner, repo, visibility });
        }

        const verifiedVisibility = await readVisibility(ghBin, host, owner, repo);
        // Never publish notes unexpectedly: block if the repo is public but the
        // user did not knowingly opt in (research R5 §4).
        if (verifiedVisibility === 'public' && input.acknowledgePublic !== true) {
          throw new Error(
            'This repository is public. Acknowledge public visibility or choose a private repository before pushing.',
          );
        }
        const url =
          (await resolveRemoteUrl(ghBin, host, owner, repo)) ??
          `https://${host}/${owner}/${repo}.git`;
        remote = {
          mode: 'gh',
          host,
          owner,
          repo,
          visibility: verifiedVisibility,
          remoteUrl: url,
          autoPush: input.autoPush,
        };
      }

      await this.setOrigin(gitBin, remote.remoteUrl);
      const push = await this.pushInternal(gitBin, branch);
      return { remote, pushState: push.state, ...(push.detail ? { detail: push.detail } : {}) };
    });
  }

  /** Push local commits to the configured remote. Coalesces overlapping calls. */
  async pushNow(): Promise<{ state: GitSyncState; detail?: string }> {
    return this.queue.runSingleFlight('push', async () => {
      const gitBin = await this.git();
      const state = await preflight(gitBin, this.vaultDir);
      if (state.kind !== 'ready') {
        return { state: 'not-ready' as GitSyncState, detail: 'The vault is not ready to push.' };
      }
      if (!state.remoteUrl) {
        // No origin is configured in the repo, so a push is impossible. Never
        // report 'clean' here — that would make callers persist lastPushAt and
        // show a false "Backed up" status.
        return {
          state: 'not-ready' as GitSyncState,
          detail: 'No backup remote is configured for this vault.',
        };
      }
      return this.pushInternal(gitBin, state.branch);
    });
  }

  /** Detach the backup remote. Never touches notes or local history. */
  async removeRemote(): Promise<void> {
    return this.queue.runExclusive(async () => {
      const gitBin = await this.git();
      await runGit(gitBin, this.vaultDir, ['remote', 'remove', 'origin'], { allowNonZero: true });
    });
  }

  /** Compute the current backup status for the UI. */
  async status(settings: GitSettings): Promise<GitBackupStatus> {
    const gitOk = await this.gitAvailable();
    const ghOk = gitOk ? await this.ghAvailable() : false;
    const available = { git: gitOk, gh: ghOk };

    if (!settings.enabled) {
      return { available, settings, syncState: 'disabled', dirty: false };
    }
    if (!gitOk) {
      return { available, settings, syncState: 'no-git', dirty: false };
    }

    const gitBin = await this.git();
    const state = await preflight(gitBin, this.vaultDir);
    if (state.kind !== 'ready') {
      const detail = state.kind === 'blocked' ? state.reason : undefined;
      return {
        available,
        settings,
        syncState: state.kind === 'unborn' ? 'clean' : 'not-ready',
        dirty: false,
        ...(detail ? { detail } : {}),
      };
    }

    const dirty = await isDirty(gitBin, this.vaultDir);
    const ahead = state.hasUpstream ? await countAhead(gitBin, this.vaultDir) : undefined;

    // Settings expect a backup remote but the repo has no origin (e.g. it was
    // removed outside the app). Don't claim the vault is backed up.
    if (settings.remote && !state.remoteUrl) {
      return {
        available,
        settings,
        syncState: 'not-ready',
        dirty,
        detail: 'The backup remote is no longer configured in this repository.',
        ...(ahead !== undefined ? { ahead } : {}),
      };
    }

    let syncState: GitSyncState;
    if (dirty) syncState = 'uncommitted';
    else if (!settings.remote) syncState = 'clean';
    else if ((ahead ?? 0) > 0) syncState = 'committed-not-pushed';
    else syncState = 'clean';

    return {
      available,
      settings,
      syncState,
      dirty,
      ...(ahead !== undefined ? { ahead } : {}),
    };
  }

  /** Drain the operation queue (used by the quit barrier). */
  async drain(): Promise<void> {
    await this.queue.drain();
  }
}
