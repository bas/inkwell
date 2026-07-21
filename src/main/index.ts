import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeTheme, shell } from 'electron';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import {
  readSettings,
  setAiModelPreference,
  setColorMode,
  setFeatureEnabled,
  setVaultPath,
  setWindowBounds,
} from './settings';
import { registerNoteHandlers } from './ipc';
import { configureSpellcheck, attachSpellcheckMenu } from './spellcheck';
import { registerAiHandlers, disposeAi } from './ai';
import { buildAppMenu } from './menu';
import { GitBackup } from './git';
import { resolveVaultDir } from './vault';
import { IpcChannels, type VaultChooseResult } from '../shared/ipc';
import {
  normalizeAiModelPreference,
  isFeatureKey,
  normalizeVaultPath,
  type ColorModePreference,
} from '../shared/types';
import type { NotesService } from './storage/notesService';

// Name the app so the macOS menu bar and dialogs say "Inkwell" (not "Electron")
// even in development, where the name otherwise defaults to Electron's.
app.setName('Inkwell');

const isDev = !app.isPackaged;
const isE2EHeadless =
  process.env['INKWELL_E2E_HEADLESS'] === '1' || process.env['INKWELL_E2E_HEADLESS'] === 'true';

let notesService: NotesService | undefined;
let gitBackup: GitBackup | undefined;

function createWindow(): BrowserWindow {
  const { windowBounds } = readSettings();
  const window = new BrowserWindow({
    width: windowBounds?.width ?? 1100,
    height: windowBounds?.height ?? 720,
    x: windowBounds?.x,
    y: windowBounds?.y,
    minWidth: 720,
    minHeight: 480,
    show: false,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.on('ready-to-show', () => {
    if (!isE2EHeadless) window.show();
  });

  // Persist window position and size so the next launch restores it.
  const saveBounds = (): void => {
    if (!window.isDestroyed() && !window.isMinimized()) setWindowBounds(window.getBounds());
  };
  window.on('close', saveBounds);

  // English spellcheck for editable surfaces, with a suggestions context menu.
  configureSpellcheck(window.webContents.session);
  attachSpellcheckMenu(window.webContents);

  // Open external links in the user's browser; never inside the app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Block navigation away from the app (prevents phishing via crafted links).
  const allowedOrigin = isDev ? process.env['ELECTRON_RENDERER_URL'] : undefined;
  window.webContents.on('will-navigate', (event, url) => {
    if (allowedOrigin && url.startsWith(allowedOrigin)) return;
    if (url.startsWith('file://')) return;
    event.preventDefault();
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return window;
}

function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannels.getSettings, () => readSettings());

  ipcMain.handle(IpcChannels.setColorMode, (_event, mode: unknown) => {
    if (mode !== 'light' && mode !== 'dark' && mode !== 'auto') {
      throw new Error('Invalid color mode');
    }
    return setColorMode(mode as ColorModePreference);
  });

  ipcMain.handle(IpcChannels.setFeatureEnabled, (_event, feature: unknown, enabled: unknown) => {
    if (!isFeatureKey(feature)) throw new Error('Invalid feature key');
    if (typeof enabled !== 'boolean') throw new Error('Feature enabled must be a boolean');
    return setFeatureEnabled(feature, enabled);
  });

  ipcMain.handle(IpcChannels.getAiModelPreference, () => readSettings().aiModel);

  ipcMain.handle(IpcChannels.setAiModelPreference, (_event, model: unknown) => {
    if (typeof model !== 'string') throw new Error('AI model preference must be a string');
    if (normalizeAiModelPreference(model) !== model.trim()) {
      throw new Error('Invalid AI model preference');
    }
    return setAiModelPreference(model);
  });

  ipcMain.handle(IpcChannels.writeClipboard, (_event, text: unknown) => {
    if (typeof text !== 'string') throw new Error('Clipboard text must be a string');
    clipboard.writeText(text);
  });
}

/**
 * Vault-location handlers. Registered once the window and resolved vault path are
 * available: the picker is anchored to the window, and `getVaultPath` reports the
 * path actually in use (which may be an `INKWELL_VAULT_DIR` override that is never
 * persisted). Choosing a new folder persists it and relaunches so the notes
 * service, SQLite index, and git backup re-initialise cleanly.
 */
function registerVaultHandlers(window: BrowserWindow, vaultDir: string): void {
  ipcMain.handle(IpcChannels.getVaultPath, () => vaultDir);

  ipcMain.handle(IpcChannels.chooseVaultLocation, async (): Promise<VaultChooseResult> => {
    const result = await dialog.showOpenDialog(window, {
      title: 'Choose notes vault folder',
      message:
        'Inkwell will restart to use this folder as your notes vault. Existing notes are NOT moved - copy them into the new folder first if you want them here.',
      buttonLabel: 'Use this folder',
      defaultPath: vaultDir,
      properties: ['openDirectory', 'createDirectory'],
    });
    const chosen = normalizeVaultPath(result.filePaths[0]);
    if (result.canceled || !chosen || chosen === vaultDir) return { changed: false };
    setVaultPath(chosen);
    // Relaunch via app.quit() (not app.exit) so the before-quit barrier flushes
    // pending autosave commits/pushes and disposes the DB/watcher cleanly before
    // the process exits and the relaunched instance re-initialises.
    app.relaunch();
    app.quit();
    return { changed: true, path: chosen };
  });
}

function isBetterSqliteAbiMismatch(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes('better_sqlite3.node') && error.message.includes('NODE_MODULE_VERSION')
  );
}

function rebuildBetterSqliteForElectron(): void {
  const result = spawnSync('npm', ['run', 'rebuild'], {
    cwd: app.getAppPath(),
    encoding: 'utf8',
  });
  if (result.status === 0) return;

  const details = [result.error?.message, result.stdout, result.stderr]
    .filter(Boolean)
    .join('\n')
    .trim();
  throw new Error(
    details
      ? `Automatic native module rebuild failed.\n\n${details}`
      : 'Automatic native module rebuild failed.',
  );
}

async function createNotesService(vaultDir: string, dbPath: string): Promise<NotesService> {
  const { NotesService } = await import('./storage/notesService');
  try {
    return new NotesService(vaultDir, dbPath);
  } catch (error) {
    if (!isDev || !isBetterSqliteAbiMismatch(error)) throw error;
    rebuildBetterSqliteForElectron();
    return new NotesService(vaultDir, dbPath);
  }
}

app.whenReady().then(async () => {
  registerIpcHandlers();

  let vaultDir: string;
  try {
    vaultDir = resolveVaultDir({
      envVaultDir: process.env['INKWELL_VAULT_DIR'],
      homeDir: app.getPath('home'),
      documentsDir: app.getPath('documents'),
      persistedVaultPath: readSettings().vaultPath,
      persist: (path) => setVaultPath(path),
    });
  } catch (err) {
    // Resolution creates and persists the default vault; if that fails (e.g.
    // mkdir/permission/disk error) there is no usable vault, so surface it and
    // quit rather than letting the unhandled rejection crash the app silently.
    dialog.showErrorBox(
      'Inkwell could not open your notes',
      `The notes vault location could not be prepared.\n\n${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    app.quit();
    return;
  }
  const dbPath = join(app.getPath('userData'), 'index.sqlite');
  try {
    notesService = await createNotesService(vaultDir, dbPath);
    registerNoteHandlers(notesService);
    registerAiHandlers(notesService);
    gitBackup = new GitBackup(vaultDir, notesService);
    gitBackup.registerHandlers();
  } catch (err) {
    dialog.showErrorBox(
      'Inkwell could not open your notes',
      `The notes vault or index could not be initialized.\n\n${
        err instanceof Error ? err.message : String(err)
      }\n\nVault: ${vaultDir}`,
    );
  }

  const window = createWindow();
  gitBackup?.setWindow(window);
  registerVaultHandlers(window, vaultDir);

  buildAppMenu(window, {
    onRevealVault: () => {
      void shell.openPath(vaultDir);
    },
    onRebuildIndex: () => {
      try {
        notesService?.rebuildIndex();
        if (!window.isDestroyed()) window.webContents.send(IpcChannels.notesChanged);
      } catch (err) {
        dialog.showErrorBox('Rebuild failed', err instanceof Error ? err.message : String(err));
      }
    },
  });

  // Reindex and notify the renderer when notes change on disk externally.
  try {
    await notesService?.startWatching(
      () => {
        if (!window.isDestroyed()) window.webContents.send(IpcChannels.notesChanged);
      },
      (error) => {
        dialog.showErrorBox(
          'Inkwell could not watch your notes vault',
          `External note changes will not auto-refresh.\n\n${
            error instanceof Error ? error.message : String(error)
          }\n\nVault: ${vaultDir}`,
        );
      },
    );
  } catch (error) {
    dialog.showErrorBox(
      'Inkwell could not watch your notes vault',
      `External note changes will not auto-refresh.\n\n${
        error instanceof Error ? error.message : String(error)
      }\n\nVault: ${vaultDir}`,
    );
  }

  // Forward system appearance changes so the renderer can react when in `auto`.
  nativeTheme.on('updated', () => {
    if (!window.isDestroyed()) {
      window.webContents.send(
        IpcChannels.systemColorSchemeChanged,
        nativeTheme.shouldUseDarkColors,
      );
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

let quitting = false;

app.on('before-quit', (event) => {
  if (quitting) return;
  if (!gitBackup) return;
  // Hold quit until pending autosave commits/pushes have flushed, then tear down.
  event.preventDefault();
  quitting = true;
  const done = (): void => {
    // will-quit is skipped once `quitting` is set, so this is the only teardown
    // path. Await the watcher/db and Copilot client disposal before exiting, but
    // bound it so a stuck disposal can't hang shutdown indefinitely.
    const teardown = Promise.allSettled([
      notesService?.dispose() ?? Promise.resolve(),
      disposeAi(),
    ]);
    let teardownTimer: NodeJS.Timeout | undefined;
    const teardownTimeout = new Promise<void>((resolve) => {
      teardownTimer = setTimeout(resolve, 2000);
    });
    void Promise.race([teardown, teardownTimeout]).finally(() => {
      if (teardownTimer) clearTimeout(teardownTimer);
      app.quit();
    });
  };
  const barrier = gitBackup.flushForQuit();
  // Never let a stuck network push block shutdown indefinitely. Clear the timer
  // once the race settles so it can't keep the event loop alive after a fast
  // flush and needlessly delay quit.
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, 8000);
  });
  void Promise.race([barrier, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
    done();
  });
});

app.on('will-quit', () => {
  if (quitting) return;
  void notesService?.dispose();
  void disposeAi();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
