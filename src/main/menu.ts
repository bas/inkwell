import { app, Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import { IpcChannels } from '../shared/ipc';

interface MenuActions {
  onRevealVault: () => void;
  onRebuildIndex: () => void;
}

/** Build and install the native application menu, including Inkwell commands. */
export function buildAppMenu(window: BrowserWindow, actions: MenuActions): void {
  const isMac = process.platform === 'darwin';

  // Build the macOS app menu explicitly so its label is always the app name
  // ("Inkwell"). The `appMenu` role derives its label from the bundle name,
  // which shows "Electron" in development.
  const appMenu: MenuItemConstructorOptions = {
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ],
  };

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [appMenu] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Note',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (!window.isDestroyed()) window.webContents.send(IpcChannels.menuNewNote);
          },
        },
        { type: 'separator' },
        { label: 'Reveal Vault in Finder', click: actions.onRevealVault },
        { label: 'Rebuild Index', click: actions.onRebuildIndex },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
