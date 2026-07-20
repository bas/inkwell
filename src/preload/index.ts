import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels, type InkwellApi } from '../shared/ipc';
import type { AiModelPreference, ColorModePreference, FeatureKey } from '../shared/types';
import type { CreateNoteInput, UpdateNoteInput } from '../shared/note';
import type {
  AiFixBodySuggestion,
  AiReviewOptions,
  AiReviewSuggestion,
  AiStreamChunk,
} from '../shared/ai';
import type { GitAutoCommitMode, GitBackupStatus, GitRemoteSetupInput } from '../shared/git';

const api: InkwellApi = {
  getSettings: () => ipcRenderer.invoke(IpcChannels.getSettings),
  setColorMode: (mode: ColorModePreference) => ipcRenderer.invoke(IpcChannels.setColorMode, mode),
  setFeatureEnabled: (feature: FeatureKey, enabled: boolean) =>
    ipcRenderer.invoke(IpcChannels.setFeatureEnabled, feature, enabled),
  getAiModelPreference: () => ipcRenderer.invoke(IpcChannels.getAiModelPreference),
  setAiModelPreference: (model: AiModelPreference) =>
    ipcRenderer.invoke(IpcChannels.setAiModelPreference, model),
  getVaultPath: () => ipcRenderer.invoke(IpcChannels.getVaultPath),
  chooseVaultLocation: () => ipcRenderer.invoke(IpcChannels.chooseVaultLocation),
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
  listAiModels: () => ipcRenderer.invoke(IpcChannels.aiListModels),

  summarizeNote: (noteId: string, requestId: string) =>
    ipcRenderer.invoke(IpcChannels.aiSummarize, noteId, requestId),

  cancelSummarize: (requestId: string) => ipcRenderer.invoke(IpcChannels.aiCancel, requestId),

  insertTldr: (noteId: string, summary: string) =>
    ipcRenderer.invoke(IpcChannels.aiInsertTldr, noteId, summary),

  reviewNote: (noteId: string, requestId: string, options?: AiReviewOptions) =>
    ipcRenderer.invoke(IpcChannels.aiReview, noteId, requestId, options),

  cancelReview: (requestId: string) => ipcRenderer.invoke(IpcChannels.aiReviewCancel, requestId),

  applyReviewSuggestion: (noteId: string, suggestion: AiReviewSuggestion) =>
    ipcRenderer.invoke(IpcChannels.aiApplyReviewSuggestion, noteId, suggestion),

  fixNote: (noteId: string, requestId: string) =>
    ipcRenderer.invoke(IpcChannels.aiFix, noteId, requestId),

  cancelFix: (requestId: string) => ipcRenderer.invoke(IpcChannels.aiFixCancel, requestId),

  applyFixSuggestion: (noteId: string, suggestion: AiFixBodySuggestion) =>
    ipcRenderer.invoke(IpcChannels.aiApplyFixSuggestion, noteId, suggestion),

  onAiStreamDelta: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, chunk: AiStreamChunk): void =>
      listener(chunk);
    ipcRenderer.on(IpcChannels.aiStreamDelta, handler);
    return () => ipcRenderer.removeListener(IpcChannels.aiStreamDelta, handler);
  },

  onMenuNewNote: (listener) => {
    const handler = (): void => listener();
    ipcRenderer.on(IpcChannels.menuNewNote, handler);
    return () => ipcRenderer.removeListener(IpcChannels.menuNewNote, handler);
  },

  getGitStatus: () => ipcRenderer.invoke(IpcChannels.gitGetStatus),
  setGitEnabled: (enabled: boolean) => ipcRenderer.invoke(IpcChannels.gitSetEnabled, enabled),
  setGitAutoCommit: (mode: GitAutoCommitMode, intervalMinutes?: number) =>
    ipcRenderer.invoke(IpcChannels.gitSetAutoCommit, mode, intervalMinutes),
  setGitAutoPush: (enabled: boolean) => ipcRenderer.invoke(IpcChannels.gitSetAutoPush, enabled),
  getGitDestinations: () => ipcRenderer.invoke(IpcChannels.gitGetDestinations),
  checkGitRepoName: (host: string | undefined, owner: string, name: string) =>
    ipcRenderer.invoke(IpcChannels.gitCheckRepoName, host, owner, name),
  setupGitRemote: (input: GitRemoteSetupInput) =>
    ipcRenderer.invoke(IpcChannels.gitSetupRemote, input),
  removeGitRemote: () => ipcRenderer.invoke(IpcChannels.gitRemoveRemote),
  gitPushNow: () => ipcRenderer.invoke(IpcChannels.gitPushNow),
  onGitStatusChanged: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, status: GitBackupStatus): void =>
      listener(status);
    ipcRenderer.on(IpcChannels.gitStatusChanged, handler);
    return () => ipcRenderer.removeListener(IpcChannels.gitStatusChanged, handler);
  },
};

contextBridge.exposeInMainWorld('api', api);
