import { Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import { IpcChannels } from '../shared/ipc';

interface MenuActions {
  onRevealVault: () => void;
  onRebuildIndex: () => void;
}

/** Build and install the native application menu, including Inkwell commands. */
export function buildAppMenu(window: BrowserWindow, actions: MenuActions): void {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
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
