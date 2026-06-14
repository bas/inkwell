import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels, type InkwellApi } from '../shared/ipc';
import type { ColorModePreference } from '../shared/types';
import type { CreateNoteInput, UpdateNoteInput } from '../shared/note';

const api: InkwellApi = {
  getSettings: () => ipcRenderer.invoke(IpcChannels.getSettings),
  setColorMode: (mode: ColorModePreference) => ipcRenderer.invoke(IpcChannels.setColorMode, mode),
  onSystemColorSchemeChanged: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, isDark: boolean): void => listener(isDark);
    ipcRenderer.on(IpcChannels.systemColorSchemeChanged, handler);
    return () => ipcRenderer.removeListener(IpcChannels.systemColorSchemeChanged, handler);
  },

  listNotes: (labelName?: string) => ipcRenderer.invoke(IpcChannels.listNotes, labelName),
  searchNotes: (query: string) => ipcRenderer.invoke(IpcChannels.searchNotes, query),
  getNote: (id: string) => ipcRenderer.invoke(IpcChannels.getNote, id),
  createNote: (input: CreateNoteInput) => ipcRenderer.invoke(IpcChannels.createNote, input),
  updateNote: (input: UpdateNoteInput) => ipcRenderer.invoke(IpcChannels.updateNote, input),
  deleteNote: (id: string) => ipcRenderer.invoke(IpcChannels.deleteNote, id),
  onNotesChanged: (listener) => {
    const handler = (): void => listener();
    ipcRenderer.on(IpcChannels.notesChanged, handler);
    return () => ipcRenderer.removeListener(IpcChannels.notesChanged, handler);
  },

  listLabels: () => ipcRenderer.invoke(IpcChannels.listLabels),
  createLabel: (name: string, color?: string) =>
    ipcRenderer.invoke(IpcChannels.createLabel, name, color),
  setLabelColor: (id: number, color: string) =>
    ipcRenderer.invoke(IpcChannels.setLabelColor, id, color),
  deleteLabel: (id: number) => ipcRenderer.invoke(IpcChannels.deleteLabel, id),

  writeClipboard: (text: string) => ipcRenderer.invoke(IpcChannels.writeClipboard, text),

  getAiAvailability: () => ipcRenderer.invoke(IpcChannels.aiGetAvailability),

  onMenuNewNote: (listener) => {
    const handler = (): void => listener();
    ipcRenderer.on(IpcChannels.menuNewNote, handler);
    return () => ipcRenderer.removeListener(IpcChannels.menuNewNote, handler);
  },
};

contextBridge.exposeInMainWorld('api', api);
