import { createRequire } from 'node:module';
import type { Database as DB } from 'better-sqlite3';
import type { NoteSummary } from '../../shared/note';
import type { Label } from '../../shared/note-labels';
import { makeSnippet } from './snippet';

const SCHEMA_VERSION = 1;
const require = createRequire(import.meta.url);

function loadDatabaseConstructor(): typeof import('better-sqlite3') {
  return require('better-sqlite3') as typeof import('better-sqlite3');
}

/** Open the index database and run migrations. */
export function openDatabase(path: string): DB {
  const Database = loadDatabaseConstructor();
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db: DB): void {
  db.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  const row = db.prepare(`SELECT value FROM meta WHERE key = 'schema_version'`).get() as
    | { value: string }
    | undefined;
  const current = row ? Number(row.value) : 0;
  if (current >= SCHEMA_VERSION) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      title TEXT NOT NULL,
      pinned INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      snippet TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT 'default'
    );
    CREATE TABLE IF NOT EXISTS note_labels (
      noteId TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      labelId INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
      PRIMARY KEY (noteId, labelId)
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(noteId UNINDEXED, title, body);
  `);
  db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)`).run(
    String(SCHEMA_VERSION),
  );
}

/** Ensure each named label exists; return a name→id map. */
function ensureLabels(db: DB, names: string[]): Map<string, number> {
  const insert = db.prepare(`INSERT OR IGNORE INTO labels (name) VALUES (?)`);
  const select = db.prepare(`SELECT id, name FROM labels WHERE name = ?`);
  const map = new Map<string, number>();
  for (const name of names) {
    insert.run(name);
    const row = select.get(name) as { id: number; name: string } | undefined;
    if (row) map.set(name, row.id);
  }
  return map;
}

interface UpsertInput {
  id: string;
  path: string;
  title: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  body: string;
  labels: string[];
}

/** Insert or update a note row, its labels, and its full-text index entry. */
export function upsertNote(db: DB, input: UpsertInput): void {
  const tx = db.transaction((n: UpsertInput) => {
    db.prepare(
      `INSERT INTO notes (id, path, title, pinned, createdAt, updatedAt, snippet)
       VALUES (@id, @path, @title, @pinned, @createdAt, @updatedAt, @snippet)
       ON CONFLICT(id) DO UPDATE SET
         path = excluded.path, title = excluded.title, pinned = excluded.pinned,
         updatedAt = excluded.updatedAt, snippet = excluded.snippet`,
    ).run({
      id: n.id,
      path: n.path,
      title: n.title,
      pinned: n.pinned ? 1 : 0,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      snippet: makeSnippet(n.body),
    });

    db.prepare(`DELETE FROM note_labels WHERE noteId = ?`).run(n.id);
    const labelIds = ensureLabels(db, n.labels);
    const link = db.prepare(`INSERT OR IGNORE INTO note_labels (noteId, labelId) VALUES (?, ?)`);
    for (const labelId of labelIds.values()) link.run(n.id, labelId);

    db.prepare(`DELETE FROM notes_fts WHERE noteId = ?`).run(n.id);
    db.prepare(`INSERT INTO notes_fts (noteId, title, body) VALUES (?, ?, ?)`).run(
      n.id,
      n.title,
      n.body,
    );
  });
  tx(input);
}

/** Remove a note (and its labels/FTS rows) from the index. */
export function deleteNote(db: DB, id: string): void {
  const tx = db.transaction((noteId: string) => {
    db.prepare(`DELETE FROM notes WHERE id = ?`).run(noteId);
    db.prepare(`DELETE FROM notes_fts WHERE noteId = ?`).run(noteId);
  });
  tx(id);
}

function labelsFor(db: DB, noteId: string): string[] {
  const rows = db
    .prepare(
      `SELECT l.name FROM labels l
       JOIN note_labels nl ON nl.labelId = l.id
       WHERE nl.noteId = ? ORDER BY l.name`,
    )
    .all(noteId) as { name: string }[];
  return rows.map((r) => r.name);
}

interface NoteRow {
  id: string;
  title: string;
  pinned: number;
  updatedAt: string;
  snippet: string;
}

function toSummary(db: DB, row: NoteRow): NoteSummary {
  return {
    id: row.id,
    title: row.title,
    snippet: row.snippet,
    labels: labelsFor(db, row.id),
    pinned: row.pinned === 1,
    updatedAt: row.updatedAt,
  };
}

/** List note summaries, newest first with pinned notes on top, optionally filtered by label. */
export function listSummaries(db: DB, labelName?: string): NoteSummary[] {
  const rows = labelName
    ? (db
        .prepare(
          `SELECT n.* FROM notes n
           JOIN note_labels nl ON nl.noteId = n.id
           JOIN labels l ON l.id = nl.labelId
           WHERE l.name = ?
           ORDER BY n.pinned DESC, n.updatedAt DESC`,
        )
        .all(labelName) as NoteRow[])
    : (db.prepare(`SELECT * FROM notes ORDER BY pinned DESC, updatedAt DESC`).all() as NoteRow[]);
  return rows.map((r) => toSummary(db, r));
}

/** Full-text search note title + body, ranked by relevance. */
export function searchSummaries(db: DB, query: string): NoteSummary[] {
  const trimmed = query.trim();
  if (!trimmed) return listSummaries(db);
  // Prefix-match each term so partial words match as the user types.
  const match = trimmed
    .split(/\s+/)
    .map((term) => `${term.replace(/["*]/g, '')}*`)
    .filter((t) => t.length > 1)
    .join(' ');
  if (!match) return listSummaries(db);
  let rows: NoteRow[];
  try {
    rows = db
      .prepare(
        `SELECT n.* FROM notes_fts f
         JOIN notes n ON n.id = f.noteId
         WHERE notes_fts MATCH ?
         ORDER BY rank`,
      )
      .all(match) as NoteRow[];
  } catch {
    return [];
  }
  return rows.map((r) => toSummary(db, r));
}

/** Rebuild the entire index from the given notes (used on startup / recovery). */
export function rebuildIndex(db: DB, notes: Array<{ path: string; note: UpsertInput }>): void {
  const tx = db.transaction(() => {
    // Snapshot label colors before clearing so user-assigned colors survive the rebuild.
    const savedColors = db
      .prepare(`SELECT name, color FROM labels WHERE color != 'default'`)
      .all() as { name: string; color: string }[];

    db.exec(
      `DELETE FROM note_labels; DELETE FROM notes; DELETE FROM notes_fts; DELETE FROM labels;`,
    );
    for (const { note } of notes) upsertNote(db, note);

    // Restore label colors that were set before the rebuild.
    const restore = db.prepare(`UPDATE labels SET color = ? WHERE name = ?`);
    for (const { name, color } of savedColors) {
      restore.run(color, name);
    }
  });
  tx();
}

/** List all labels with their colors. */
export function listLabels(db: DB): Label[] {
  return db.prepare(`SELECT id, name, color FROM labels ORDER BY name`).all() as Label[];
}

/** Create a label (idempotent by name); returns the label. */
export function createLabel(db: DB, name: string, color = 'default'): Label {
  db.prepare(`INSERT OR IGNORE INTO labels (name, color) VALUES (?, ?)`).run(name, color);
  return db.prepare(`SELECT id, name, color FROM labels WHERE name = ?`).get(name) as Label;
}

/** Update a label's color. */
export function setLabelColor(db: DB, id: number, color: string): void {
  db.prepare(`UPDATE labels SET color = ? WHERE id = ?`).run(color, id);
}

/** Delete a label and unlink it from all notes. */
export function deleteLabel(db: DB, id: number): void {
  db.prepare(`DELETE FROM labels WHERE id = ?`).run(id);
}
