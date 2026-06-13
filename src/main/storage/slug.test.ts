import { describe, it, expect } from 'vitest';
import { slugify, noteFilename } from './slug';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('strips diacritics', () => {
    expect(slugify('Café Notes')).toBe('cafe-notes');
  });

  it('collapses non-alphanumeric runs and trims hyphens', () => {
    expect(slugify('  A...B  /C  ')).toBe('a-b-c');
  });

  it('falls back to "untitled" for empty/symbol-only titles', () => {
    expect(slugify('')).toBe('untitled');
    expect(slugify('!!!')).toBe('untitled');
  });

  it('caps length and trims a trailing hyphen', () => {
    const slug = slugify('a'.repeat(80));
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('noteFilename', () => {
  it('combines slug with a short id and .md extension', () => {
    expect(noteFilename('My Note', '1234abcd-5678-90ef-1234-567890abcdef')).toBe(
      'my-note-1234abcd.md',
    );
  });
});
