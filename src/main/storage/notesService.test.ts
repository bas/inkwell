import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { allocateNoteFile, NotesService } from './notesService';

vi.mock('./db', () => {
  const db = { close: vi.fn() };
  return {
    openDatabase: vi.fn(() => db),
    rebuildIndex: vi.fn(),
    upsertNote: vi.fn(),
    deleteNote: vi.fn(),
    listSummaries: vi.fn(() => []),
    searchSummaries: vi.fn(() => []),
    listLabels: vi.fn(() => []),
    createLabel: vi.fn(),
    setLabelColor: vi.fn(),
    deleteLabel: vi.fn(),
  };
});

let dir: string;
let dbPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'inkwell-notes-service-'));
  dbPath = join(dir, 'index.db');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('NotesService', () => {
  it('writes notes to id-based filenames and derives titles from body content', async () => {
    const service = new NotesService(dir, dbPath);
    try {
      const note = service.createNote({ body: 'Shopping list\n\nMilk' });

      const path = join(dir, `${note.id}.md`);
      expect(existsSync(path)).toBe(true);
      expect(note.title).toBe('Shopping list');
      expect(readFileSync(path, 'utf8')).not.toContain('title:');

      const updated = service.updateNote({ id: note.id, body: '# Chores\n\nWash dishes' });
      expect(updated.title).toBe('Chores');
      expect(readFileSync(path, 'utf8')).toContain('Wash dishes');
    } finally {
      await service.dispose();
    }
  });

  it('generates a fresh id when the chosen filename already exists', async () => {
    writeFileSync(join(dir, 'collision-id.md'), '---\nid: collision-id\n---\nExisting');
    const ids = ['collision-id', 'fresh-id'];
    const { id, path } = allocateNoteFile(dir, () => ids.shift() ?? 'fresh-id');
    expect(id).toBe('fresh-id');
    expect(path).toBe(join(dir, 'fresh-id.md'));
  });

  it('suppresses no-op updates so unchanged content produces no churn or mutation', async () => {
    const service = new NotesService(dir, dbPath);
    const titles: string[][] = [];
    service.setMutationListener((t) => titles.push(t));
    try {
      const note = service.createNote({ body: 'Steady\n\nBody' });
      const canonical = service.getNote(note.id);
      titles.length = 0; // ignore the create mutation
      const again = service.updateNote({ id: note.id, body: canonical.body });
      expect(again.updatedAt).toBe(canonical.updatedAt);
      expect(titles).toEqual([]);
    } finally {
      await service.dispose();
    }
  });

  it('emits a mutation and bumps updatedAt when content actually changes', async () => {
    const service = new NotesService(dir, dbPath);
    const titles: string[][] = [];
    service.setMutationListener((t) => titles.push(t));
    try {
      const note = service.createNote({ body: 'First' });
      titles.length = 0;
      await new Promise((r) => setTimeout(r, 5));
      const updated = service.updateNote({ id: note.id, body: 'Second body' });
      expect(updated.updatedAt).not.toBe(note.updatedAt);
      expect(titles).toEqual([[updated.title]]);
    } finally {
      await service.dispose();
    }
  });

  it('rejects a stale update whose baseUpdatedAt no longer matches disk', async () => {
    const service = new NotesService(dir, dbPath);
    try {
      const note = service.createNote({ body: 'Original' });
      await new Promise((r) => setTimeout(r, 5));
      service.updateNote({ id: note.id, body: 'Newer on disk' });
      expect(() =>
        service.updateNote({ id: note.id, body: 'Racy', baseUpdatedAt: note.updatedAt }),
      ).toThrow(/changed on disk/i);
    } finally {
      await service.dispose();
    }
  });

  it('accepts an update whose baseUpdatedAt matches the current note', async () => {
    const service = new NotesService(dir, dbPath);
    try {
      const note = service.createNote({ body: 'Original' });
      const updated = service.updateNote({
        id: note.id,
        body: 'Edited',
        baseUpdatedAt: note.updatedAt,
      });
      expect(updated.body).toBe('Edited');
    } finally {
      await service.dispose();
    }
  });
});
