import type { AppSettings, ColorModePreference, FeatureKey } from './types';
import type { CreateNoteInput, Note, NoteSummary, UpdateNoteInput } from './note';
import type { Label } from './note-labels';
import type {
  GitAutoCommitMode,
  GitBackupStatus,
  GitDestinations,
  GitPushResult,
  GitRemoteSetupInput,
  GitRemoteSetupResult,
  GitRepoNameCheck,
} from './git';
import type {
  AiAvailability,
  AiFixResult,
  AiFixBodySuggestion,
  AiFixApplyResult,
  AiResult,
  AiReviewApplyResult,
  AiReviewOptions,
  AiReviewResult,
  AiReviewSuggestion,
  AiStreamChunk,
} from './ai';

/** IPC channel names. Keep in sync between main handlers and the preload bridge. */
export const IpcChannels = {
  getSettings: 'settings:get',
  setColorMode: 'settings:setColorMode',
  setFeatureEnabled: 'settings:setFeatureEnabled',
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
  /** AI: cancel an in-flight summarize request by id. */
  aiCancel: 'ai:cancel',
  /** AI: insert/replace a regenerable TL;DR block at the top of a note. */
  aiInsertTldr: 'ai:insertTldr',
  /** AI: review a note and return structured suggestions. */
  aiReview: 'ai:review',
  /** AI: cancel an in-flight review request by id. */
  aiReviewCancel: 'ai:reviewCancel',
  /** AI: apply a single review suggestion to a note body. */
  aiApplyReviewSuggestion: 'ai:applyReviewSuggestion',
  /** AI: tidy a note and return structured fix suggestions. */
  aiFix: 'ai:fix',
  /** AI: cancel an in-flight tidy request by id. */
  aiFixCancel: 'ai:fixCancel',
  /** AI: apply a single tidy body suggestion to a note body. */
  aiApplyFixSuggestion: 'ai:applyFixSuggestion',
  /** Main → renderer: a streamed chunk of an in-progress AI response. */
  aiStreamDelta: 'ai:streamDelta',

  /** Backup: current git backup status (binaries, settings, sync state). */
  gitGetStatus: 'git:getStatus',
  /** Backup: enable/disable local version history (initialises the repo). */
  gitSetEnabled: 'git:setEnabled',
  /** Backup: change when auto-commits happen. */
  gitSetAutoCommit: 'git:setAutoCommit',
  /** Backup: toggle auto-push after each local commit. */
  gitSetAutoPush: 'git:setAutoPush',
  /** Backup: discover candidate hosts/owners from `gh`. */
  gitGetDestinations: 'git:getDestinations',
  /** Backup: validate a proposed repository name and check availability. */
  gitCheckRepoName: 'git:checkRepoName',
  /** Backup: provision/attach the upstream remote and perform the first push. */
  gitSetupRemote: 'git:setupRemote',
  /** Backup: detach the upstream remote (never touches notes or history). */
  gitRemoveRemote: 'git:removeRemote',
  /** Backup: push local commits to the configured remote now. */
  gitPushNow: 'git:pushNow',
  /** Main → renderer: the backup status changed. */
  gitStatusChanged: 'git:statusChanged',

  /** Vault: the current notes vault directory path. */
  getVaultPath: 'vault:getPath',
  /** Vault: prompt for a new vault folder, persist it, and relaunch. */
  chooseVaultLocation: 'vault:chooseLocation',

  /** Main → renderer: the user picked File → New Note from the menu. */
  menuNewNote: 'menu:newNote',
} as const;

/** Outcome of prompting the user to choose a new vault location. */
export type VaultChooseResult =
  /** The user cancelled or picked the current folder; nothing changed. */
  | { changed: false }
  /** A new folder was picked (the app then relaunches). */
  | { changed: true; path: string };

/**
 * The typed API exposed to the renderer via `contextBridge` as `window.api`.
 * The renderer must only ever talk to main through this surface.
 */
export interface InkwellApi {
  getSettings(): Promise<AppSettings>;
  setColorMode(mode: ColorModePreference): Promise<AppSettings>;
  setFeatureEnabled(feature: FeatureKey, enabled: boolean): Promise<AppSettings>;
  /** Subscribe to system color-scheme changes. Returns an unsubscribe function. */
  onSystemColorSchemeChanged(listener: (isDark: boolean) => void): () => void;

  /** The absolute path to the notes vault currently in use. */
  getVaultPath(): Promise<string>;
  /**
   * Prompt the user to choose a new vault folder. When they pick one it is
   * persisted and the app relaunches, so a resolved `{ changed: true }` is not
   * observed by the renderer in practice; a cancel resolves `{ changed: false }`.
   */
  chooseVaultLocation(): Promise<VaultChooseResult>;

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
  /** Cancel an in-flight summarize request by id. Safe to call when none is running. */
  cancelSummarize(requestId: string): Promise<void>;
  /** Insert/replace a regenerable TL;DR block at the top of a note. Returns the saved note. */
  insertTldr(noteId: string, summary: string): Promise<Note>;
  /** Review a note with Copilot and return typed suggestions. */
  reviewNote(noteId: string, requestId: string, options?: AiReviewOptions): Promise<AiReviewResult>;
  /** Cancel an in-flight review request by id. */
  cancelReview(requestId: string): Promise<void>;
  /** Apply a single review suggestion and return the saved note or stale-target status. */
  applyReviewSuggestion(
    noteId: string,
    suggestion: AiReviewSuggestion,
  ): Promise<{ note: Note; apply: AiReviewApplyResult }>;
  /** Tidy a note with Copilot and return typed fix suggestions. */
  fixNote(noteId: string, requestId: string): Promise<AiFixResult>;
  /** Cancel an in-flight tidy request by id. */
  cancelFix(requestId: string): Promise<void>;
  /** Apply a single tidy body suggestion and return the saved note or stale-target status. */
  applyFixSuggestion(
    noteId: string,
    suggestion: AiFixBodySuggestion,
  ): Promise<{ note: Note; apply: AiFixApplyResult }>;
  /** Subscribe to streamed AI response chunks. Returns an unsubscribe function. */
  onAiStreamDelta(listener: (chunk: AiStreamChunk) => void): () => void;

  /** Report the current git backup status (binaries, settings, sync state). */
  getGitStatus(): Promise<GitBackupStatus>;
  /** Enable or disable local version history. Enabling initialises the vault repo. */
  setGitEnabled(enabled: boolean): Promise<GitBackupStatus>;
  /** Change when auto-commits happen (and the interval length when `interval`). */
  setGitAutoCommit(mode: GitAutoCommitMode, intervalMinutes?: number): Promise<GitBackupStatus>;
  /** Toggle whether Inkwell pushes automatically after each local commit. */
  setGitAutoPush(enabled: boolean): Promise<GitBackupStatus>;
  /** Discover candidate hosts/owners from the GitHub CLI. */
  getGitDestinations(): Promise<GitDestinations>;
  /** Validate a proposed repository name and check whether it already exists. */
  checkGitRepoName(
    host: string | undefined,
    owner: string,
    name: string,
  ): Promise<GitRepoNameCheck>;
  /** Provision/attach the upstream remote and perform the first push. */
  setupGitRemote(input: GitRemoteSetupInput): Promise<GitRemoteSetupResult>;
  /** Detach the upstream remote. Never touches notes or local history. */
  removeGitRemote(): Promise<GitBackupStatus>;
  /** Push local commits to the configured remote now. */
  gitPushNow(): Promise<GitPushResult>;
  /** Subscribe to backup status changes. Returns an unsubscribe function. */
  onGitStatusChanged(listener: (status: GitBackupStatus) => void): () => void;

  /** Subscribe to the File → New Note menu command. Returns an unsubscribe function. */
  onMenuNewNote(listener: () => void): () => void;
}
