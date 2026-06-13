import { app, BrowserWindow, ipcMain, nativeTheme, shell } from 'electron';
import { join } from 'node:path';
import { readSettings, setColorMode } from './settings';
import { NotesService } from './storage/notesService';
import { registerNoteHandlers } from './ipc';
import { IpcChannels } from '../shared/ipc';
import type { ColorModePreference } from '../shared/types';

const isDev = !app.isPackaged;

let notesService: NotesService | undefined;

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1100,
    height: 720,
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
}

app.whenReady().then(() => {
  registerIpcHandlers();

  const vaultDir = join(app.getPath('documents'), 'Inkwell');
  const dbPath = join(app.getPath('userData'), 'index.sqlite');
  notesService = new NotesService(vaultDir, dbPath);
  registerNoteHandlers(notesService);

  const window = createWindow();

  // Reindex and notify the renderer when notes change on disk externally.
  notesService.startWatching(() => {
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
