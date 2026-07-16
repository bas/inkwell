import { describe, expect, it } from 'vitest';
import { deriveNoteTitle } from './noteTitle';

describe('deriveNoteTitle', () => {
  it('uses the first non-empty line', () => {
    expect(deriveNoteTitle('\n\nShopping list\n\nMilk')).toBe('Shopping list');
  });

  it('strips common markdown prefixes', () => {
    expect(deriveNoteTitle('# Shopping list')).toBe('Shopping list');
    expect(deriveNoteTitle('- Shopping list')).toBe('Shopping list');
    expect(deriveNoteTitle('> Shopping list')).toBe('Shopping list');
  });

  it('skips inserted TL;DR blocks when deriving the title', () => {
    expect(deriveNoteTitle('> **TL;DR** — Quick summary\n> of the note\n\nShopping list')).toBe(
      'Shopping list',
    );
  });

  it('falls back to Start writing for empty content', () => {
    expect(deriveNoteTitle('')).toBe('Start writing');
  });
});
