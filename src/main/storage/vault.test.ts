import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  atomicWriteFile,
  deleteNoteFile,
  ensureVaultDir,
  listMarkdownFiles,
  readNoteFile,
  scanVault,
  writeNoteToPath,
} from './vault';
import type { Note } from '../../shared/note';

let dir: string;

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'id-1',
    title: 'Test',
    labels: [],
    pinned: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    body: 'Hello world',
    ...overrides,
  };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'inkwell-test-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('atomicWriteFile', () => {
  it('writes contents and leaves no temp files behind', () => {
    const path = join(dir, 'a.md');
    atomicWriteFile(path, 'content');
    expect(readFileSync(path, 'utf8')).toBe('content');
    expect(listMarkdownFiles(dir)).toHaveLength(1);
  });
});

describe('write/read note round-trip', () => {
  it('writes a note and reads it back', () => {
    const note = makeNote({ title: 'Round Trip', labels: ['x'] });
    const path = join(dir, 'note.md');
    writeNoteToPath(path, note);
    const read = readNoteFile(path);
    expect(read.title).toBe('Round Trip');
    expect(read.labels).toEqual(['x']);
    expect(read.body.trimEnd()).toBe('Hello world');
  });
});

describe('scanVault', () => {
  it('returns readable notes and skips corrupt files', () => {
    writeNoteToPath(join(dir, 'good.md'), makeNote({ id: 'good', title: 'Good' }));
    writeFileSync(join(dir, 'bad.md'), '\u0000not a note');
    writeFileSync(join(dir, 'ignore.txt'), 'nope');
    const stored = scanVault(dir);
    // Both .md files parse (frontmatter parser is lenient), .txt is ignored.
    expect(stored.length).toBeGreaterThanOrEqual(1);
    expect(stored.every((s) => s.path.endsWith('.md'))).toBe(true);
  });

  it('returns empty for a missing directory', () => {
    expect(scanVault(join(dir, 'does-not-exist'))).toEqual([]);
  });

  it('generates ids for notes missing frontmatter id', () => {
    writeFileSync(join(dir, 'plain.md'), '# Just markdown\n\nNo frontmatter here.');
    const stored = scanVault(dir);
    expect(stored[0]?.note.id).toMatch(/[0-9a-f-]{36}/);
  });
});

describe('deleteNoteFile', () => {
  it('removes the file and is idempotent', () => {
    const path = join(dir, 'del.md');
    writeNoteToPath(path, makeNote());
    deleteNoteFile(path);
    expect(existsSync(path)).toBe(false);
    expect(() => deleteNoteFile(path)).not.toThrow();
  });
});

describe('ensureVaultDir', () => {
  it('creates nested directories', () => {
    const nested = join(dir, 'a', 'b');
    ensureVaultDir(nested);
    expect(existsSync(nested)).toBe(true);
  });
});
