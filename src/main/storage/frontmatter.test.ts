import { describe, it, expect } from 'vitest';
import { readNote, serializeNote, normalizeFrontmatter, parseNoteFile } from './frontmatter';
import type { Note } from '../../shared/note';

const SAMPLE = `---
id: abc123
title: My Note
labels:
  - work
  - ideas
pinned: true
createdAt: '2026-01-01T00:00:00.000Z'
updatedAt: '2026-01-02T00:00:00.000Z'
---
# Heading

Some **bold** text.
`;

describe('parseNoteFile', () => {
  it('splits frontmatter and body', () => {
    const { data, body } = parseNoteFile(SAMPLE);
    expect(data['title']).toBe('My Note');
    expect(body.startsWith('# Heading')).toBe(true);
  });

  it('treats malformed frontmatter as body without throwing', () => {
    const raw = '---\n: : not yaml :\n---\nbody';
    const { body } = parseNoteFile(raw);
    expect(typeof body).toBe('string');
  });
});

describe('normalizeFrontmatter', () => {
  it('generates an id when missing', () => {
    const fm = normalizeFrontmatter({ title: 'x' });
    expect(fm.id).toMatch(/[0-9a-f-]{36}/);
  });

  it('defaults title, labels, pinned, and timestamps', () => {
    const fm = normalizeFrontmatter({}, '2026-05-05T00:00:00.000Z');
    expect(fm.title).toBe('Untitled');
    expect(fm.labels).toEqual([]);
    expect(fm.pinned).toBe(false);
    expect(fm.createdAt).toBe('2026-05-05T00:00:00.000Z');
    expect(fm.updatedAt).toBe('2026-05-05T00:00:00.000Z');
  });

  it('filters non-string labels', () => {
    const fm = normalizeFrontmatter({ labels: ['a', 2, null, 'b'] });
    expect(fm.labels).toEqual(['a', 'b']);
  });
});

describe('readNote / serializeNote round-trip', () => {
  it('parses a note', () => {
    const note = readNote(SAMPLE);
    expect(note.id).toBe('abc123');
    expect(note.title).toBe('My Note');
    expect(note.labels).toEqual(['work', 'ideas']);
    expect(note.pinned).toBe(true);
    expect(note.body).toContain('# Heading');
  });

  it('round-trips through serialize → read with stable frontmatter', () => {
    const note: Note = {
      id: 'abc123',
      title: 'My Note',
      labels: ['work', 'ideas'],
      pinned: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      body: '# Heading\n\nSome **bold** text.\n',
    };
    const serialized = serializeNote(note);
    const reparsed = readNote(serialized);
    expect(reparsed).toEqual(note);
  });
});
