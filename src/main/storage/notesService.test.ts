import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { NotesService } from './notesService';

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
});
