import type { AppSettings, ColorModePreference } from './types';
import type { CreateNoteInput, Note, NoteSummary, UpdateNoteInput } from './note';
import type { Label } from './note-labels';
import type { AiAvailability, AiResult, AiStreamChunk } from './ai';

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

  writeClipboard: 'clipboard:writeText',

  /** AI: report whether the Copilot runtime is reachable and authenticated. */
  aiGetAvailability: 'ai:getAvailability',
  /** AI: summarize a note's body. */
  aiSummarize: 'ai:summarize',
  /** Main → renderer: a streamed chunk of an in-progress AI response. */
  aiStreamDelta: 'ai:streamDelta',

  /** Main → renderer: the user picked File → New Note from the menu. */
  menuNewNote: 'menu:newNote',
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

  /** Copy plain text (e.g. Markdown) to the system clipboard. */
  writeClipboard(text: string): Promise<void>;

  /** Report whether the Copilot AI runtime is reachable and authenticated. */
  getAiAvailability(): Promise<AiAvailability>;
  /** Summarize a note's body with Copilot. Streams via `onAiStreamDelta`. */
  summarizeNote(noteId: string, requestId: string): Promise<AiResult>;
  /** Subscribe to streamed AI response chunks. Returns an unsubscribe function. */
  onAiStreamDelta(listener: (chunk: AiStreamChunk) => void): () => void;

  /** Subscribe to the File → New Note menu command. Returns an unsubscribe function. */
  onMenuNewNote(listener: () => void): () => void;
}
