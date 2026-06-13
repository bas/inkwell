import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels, type InkwellApi } from '../shared/ipc';
import type { ColorModePreference } from '../shared/types';

const api: InkwellApi = {
  getSettings: () => ipcRenderer.invoke(IpcChannels.getSettings),
  setColorMode: (mode: ColorModePreference) => ipcRenderer.invoke(IpcChannels.setColorMode, mode),
  onSystemColorSchemeChanged: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, isDark: boolean): void => listener(isDark);
    ipcRenderer.on(IpcChannels.systemColorSchemeChanged, handler);
    return () => ipcRenderer.removeListener(IpcChannels.systemColorSchemeChanged, handler);
  },
};

contextBridge.exposeInMainWorld('api', api);
