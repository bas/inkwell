import type { AppSettings, ColorModePreference } from './types';
import type { CreateNoteInput, Note, NoteSummary, UpdateNoteInput } from './note';
import type { Label } from './note-labels';

/** IPC channel names. Keep in sync between main handlers and the preload bridge. */
export const IpcChannels = {
  getSettings: 'settings:get',
  setColorMode: 'settings:setColorMode',
  /** Main → renderer: the effective system color scheme changed. */
  systemColorSchemeChanged: 'system:colorSchemeChanged',

  listNotes: 'notes:list',
  searchNotes: 'notes:search',
  getNote: 'notes:get',
  createNote: 'notes:create',
  updateNote: 'notes:update',
  deleteNote: 'notes:delete',
  /** Main → renderer: the vault changed on disk (external edit). */
  notesChanged: 'notes:changed',

  listLabels: 'labels:list',
  createLabel: 'labels:create',
  setLabelColor: 'labels:setColor',
  deleteLabel: 'labels:delete',
} as const;

/**
 * The typed API exposed to the renderer via `contextBridge` as `window.api`.
 * The renderer must only ever talk to main through this surface.
 */
export interface InkwellApi {
  getSettings(): Promise<AppSettings>;
  setColorMode(mode: ColorModePreference): Promise<AppSettings>;
  /** Subscribe to system color-scheme changes. Returns an unsubscribe function. */
  onSystemColorSchemeChanged(listener: (isDark: boolean) => void): () => void;

  listNotes(labelName?: string): Promise<NoteSummary[]>;
  searchNotes(query: string): Promise<NoteSummary[]>;
  getNote(id: string): Promise<Note>;
  createNote(input: CreateNoteInput): Promise<Note>;
  updateNote(input: UpdateNoteInput): Promise<Note>;
  deleteNote(id: string): Promise<void>;
  /** Subscribe to external vault changes. Returns an unsubscribe function. */
  onNotesChanged(listener: () => void): () => void;

  listLabels(): Promise<Label[]>;
  createLabel(name: string, color?: string): Promise<Label>;
  setLabelColor(id: number, color: string): Promise<void>;
  deleteLabel(id: number): Promise<void>;
}
