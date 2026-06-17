import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeTheme, shell } from 'electron';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { readSettings, setColorMode, setWindowBounds } from './settings';
import { registerNoteHandlers } from './ipc';
import { configureSpellcheck, attachSpellcheckMenu } from './spellcheck';
import { registerAiHandlers, disposeAi } from './ai';
import { buildAppMenu } from './menu';
import { IpcChannels } from '../shared/ipc';
import type { ColorModePreference } from '../shared/types';
import type { NotesService } from './storage/notesService';

// Name the app so the macOS menu bar and dialogs say "Inkwell" (not "Electron")
// even in development, where the name otherwise defaults to Electron's.
app.setName('Inkwell');

const isDev = !app.isPackaged;
const isE2EHeadless =
  process.env['INKWELL_E2E_HEADLESS'] === '1' || process.env['INKWELL_E2E_HEADLESS'] === 'true';

let notesService: NotesService | undefined;

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

  ipcMain.handle(IpcChannels.writeClipboard, (_event, text: unknown) => {
    if (typeof text !== 'string') throw new Error('Clipboard text must be a string');
    clipboard.writeText(text);
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

  const vaultDir = process.env['INKWELL_VAULT_DIR'] ?? join(app.getPath('documents'), 'Inkwell');
  const dbPath = join(app.getPath('userData'), 'index.sqlite');
  try {
    notesService = await createNotesService(vaultDir, dbPath);
    registerNoteHandlers(notesService);
    registerAiHandlers(notesService);
  } catch (err) {
    dialog.showErrorBox(
      'Inkwell could not open your notes',
      `The notes vault or index could not be initialized.\n\n${
        err instanceof Error ? err.message : String(err)
      }\n\nVault: ${vaultDir}`,
    );
  }

  const window = createWindow();

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
  notesService?.startWatching(() => {
    if (!window.isDestroyed()) window.webContents.send(IpcChannels.notesChanged);
  });

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

app.on('will-quit', () => {
  void notesService?.dispose();
  void disposeAi();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
