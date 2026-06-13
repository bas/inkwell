import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeSync,
} from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Note } from '../../shared/note';
import { readNote, serializeNote } from './frontmatter';

/** A note paired with its absolute file path on disk. */
export interface StoredNote {
  path: string;
  note: Note;
}

/** Ensure the vault directory exists. */
export function ensureVaultDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

/**
 * Atomically write text to `path`: write a temp file, fsync, then rename.
 * A crash mid-write therefore never corrupts or truncates the destination file.
 */
export function atomicWriteFile(path: string, contents: string): void {
  const tmp = `${path}.tmp-${randomUUID()}`;
  const fd = openSync(tmp, 'w');
  try {
    writeSync(fd, contents);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  try {
    renameSync(tmp, path);
  } catch (err) {
    try {
      rmSync(tmp, { force: true });
    } catch {
      // best-effort cleanup
    }
    throw err;
  }
}

/** Write a note to a specific path atomically and return that path. */
export function writeNoteToPath(path: string, note: Note): string {
  atomicWriteFile(path, serializeNote(note));
  return path;
}

/** Read and parse a single note file. */
export function readNoteFile(path: string): Note {
  return readNote(readFileSync(path, 'utf8'));
}

/** Delete a note file. No-op if it is already gone. */
export function deleteNoteFile(path: string): void {
  rmSync(path, { force: true });
}

/** List absolute paths of every `.md` file directly in the vault directory. */
export function listMarkdownFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries
    .filter((name) => name.toLowerCase().endsWith('.md'))
    .map((name) => join(dir, name));
}

/**
 * Scan the vault, returning every readable note with its path.
 * Unreadable files are skipped so one bad file never blocks the whole vault.
 */
export function scanVault(dir: string): StoredNote[] {
  const stored: StoredNote[] = [];
  for (const path of listMarkdownFiles(dir)) {
    try {
      stored.push({ path, note: readNoteFile(path) });
    } catch {
      // Skip unreadable/corrupt files; they surface as errors elsewhere.
    }
  }
  return stored;
}

export { join as joinPath };
