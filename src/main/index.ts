import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeTheme, shell } from 'electron';
import { join } from 'node:path';
import { readSettings, setColorMode, setWindowBounds } from './settings';
import { NotesService } from './storage/notesService';
import { registerNoteHandlers } from './ipc';
import { configureSpellcheck, attachSpellcheckMenu } from './spellcheck';
import { buildAppMenu } from './menu';
import { IpcChannels } from '../shared/ipc';
import type { ColorModePreference } from '../shared/types';

const isDev = !app.isPackaged;

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

  window.on('ready-to-show', () => window.show());

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

app.whenReady().then(() => {
  registerIpcHandlers();

  const vaultDir = process.env['INKWELL_VAULT_DIR'] ?? join(app.getPath('documents'), 'Inkwell');
  const dbPath = join(app.getPath('userData'), 'index.sqlite');
  try {
    notesService = new NotesService(vaultDir, dbPath);
    registerNoteHandlers(notesService);
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
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
