import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { watch, type FSWatcher } from 'chokidar';
import type { Database as DB } from 'better-sqlite3';
import type { CreateNoteInput, Note, NoteSummary, UpdateNoteInput } from '../../shared/note';
import type { Label } from '../../shared/note-labels';
import {
  createLabel,
  deleteLabel,
  deleteNote as dbDeleteNote,
  listLabels,
  listSummaries,
  openDatabase,
  rebuildIndex,
  searchSummaries,
  setLabelColor,
  upsertNote,
} from './db';
import { noteFilename } from './slug';
import { deleteNoteFile, ensureVaultDir, readNoteFile, scanVault, writeNoteToPath } from './vault';

/** Error thrown when a requested note id is not present in the vault. */
export class NoteNotFoundError extends Error {
  constructor(id: string) {
    super(`Note not found: ${id}`);
    this.name = 'NoteNotFoundError';
  }
}

function indexInput(note: Note, path: string): Parameters<typeof upsertNote>[1] {
  return {
    id: note.id,
    path,
    title: note.title,
    pinned: note.pinned,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    body: note.body,
    labels: note.labels,
  };
}

/**
 * Orchestrates the file vault (source of truth) and the SQLite index (cache).
 * All note reads/writes go through here; the index is rebuilt from files on
 * startup and kept in sync on every mutation and external change.
 */
export class NotesService {
  private readonly db: DB;
  private readonly idToPath = new Map<string, string>();
  private watcher: FSWatcher | undefined;
  private rescanTimer: NodeJS.Timeout | undefined;
  /** Paths currently being written by the app; suppresses watcher-triggered rebuilds. */
  private selfWritePaths = new Set<string>();

  constructor(
    private readonly vaultDir: string,
    dbPath: string,
  ) {
    ensureVaultDir(vaultDir);
    this.db = openDatabase(dbPath);
    this.rebuild();
  }

  /** Rescan the vault and rebuild the index from scratch. */
  private rebuild(): void {
    const stored = scanVault(this.vaultDir);
    this.idToPath.clear();
    const inputs = stored.map(({ path, note }) => {
      this.idToPath.set(note.id, path);
      return { path, note: indexInput(note, path) };
    });
    rebuildIndex(this.db, inputs);
  }

  /** Public entry point to force a full reindex (e.g. from the menu). */
  rebuildIndex(): void {
    this.rebuild();
  }

  /** Watch the vault for external edits; `onChange` fires (debounced) after a rebuild. */
  startWatching(onChange: () => void): void {
    this.watcher = watch(this.vaultDir, {
      depth: 0,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
    });
    const schedule = (path: string): void => {
      // Ignore events fired by our own writes.
      if (this.selfWritePaths.has(path)) {
        this.selfWritePaths.delete(path);
        return;
      }
      if (this.rescanTimer) clearTimeout(this.rescanTimer);
      this.rescanTimer = setTimeout(() => {
        this.rebuild();
        onChange();
      }, 200);
    };
    this.watcher.on('add', schedule).on('change', schedule).on('unlink', schedule);
  }

  async dispose(): Promise<void> {
    if (this.rescanTimer) clearTimeout(this.rescanTimer);
    await this.watcher?.close();
    this.db.close();
  }

  listNotes(labelName?: string): NoteSummary[] {
    return listSummaries(this.db, labelName);
  }

  searchNotes(query: string): NoteSummary[] {
    return searchSummaries(this.db, query);
  }

  getNote(id: string): Note {
    const path = this.idToPath.get(id);
    if (!path || !existsSync(path)) throw new NoteNotFoundError(id);
    return readNoteFile(path);
  }

  createNote(input: CreateNoteInput): Note {
    const now = new Date().toISOString();
    const id = randomUUID();
    const title = input.title?.trim() || 'Untitled';
    const note: Note = {
      id,
      title,
      labels: input.labels ?? [],
      pinned: false,
      createdAt: now,
      updatedAt: now,
      body: input.body ?? '',
    };
    const path = this.uniquePath(noteFilename(title, id));
    this.selfWritePaths.add(path);
    writeNoteToPath(path, note);
    this.idToPath.set(id, path);
    upsertNote(this.db, indexInput(note, path));
    return note;
  }

  updateNote(input: UpdateNoteInput): Note {
    const current = this.getNote(input.id);
    const path = this.idToPath.get(input.id);
    if (!path) throw new NoteNotFoundError(input.id);
    const next: Note = {
      ...current,
      title: input.title?.trim() ? input.title.trim() : current.title,
      body: input.body ?? current.body,
      labels: input.labels ?? current.labels,
      pinned: input.pinned ?? current.pinned,
      updatedAt: new Date().toISOString(),
    };
    this.selfWritePaths.add(path);
    writeNoteToPath(path, next);
    upsertNote(this.db, indexInput(next, path));
    return next;
  }

  deleteNote(id: string): void {
    const path = this.idToPath.get(id);
    if (path) deleteNoteFile(path);
    dbDeleteNote(this.db, id);
    this.idToPath.delete(id);
  }

  listLabels(): Label[] {
    return listLabels(this.db);
  }

  createLabel(name: string, color?: string): Label {
    return createLabel(this.db, name.trim(), color);
  }

  setLabelColor(id: number, color: string): void {
    setLabelColor(this.db, id, color);
  }

  deleteLabel(id: number): void {
    // Remove the label from every note that uses it so the files (source of
    // truth) and the index never diverge, then drop the label itself.
    const label = listLabels(this.db).find((l) => l.id === id);
    if (label) {
      for (const [noteId, path] of this.idToPath) {
        if (!existsSync(path)) continue;
        const note = readNoteFile(path);
        if (!note.labels.includes(label.name)) continue;
        const next: Note = {
          ...note,
          labels: note.labels.filter((name) => name !== label.name),
          updatedAt: new Date().toISOString(),
        };
        this.selfWritePaths.add(path);
        writeNoteToPath(path, next);
        upsertNote(this.db, indexInput(next, path));
        this.idToPath.set(noteId, path);
      }
    }
    deleteLabel(this.db, id);
  }

  /** Ensure the chosen filename does not collide with an existing file. */
  private uniquePath(filename: string): string {
    let candidate = join(this.vaultDir, filename);
    let counter = 1;
    while (existsSync(candidate)) {
      candidate = join(this.vaultDir, filename.replace(/\.md$/, `-${counter}.md`));
      counter += 1;
    }
    return candidate;
  }
}
