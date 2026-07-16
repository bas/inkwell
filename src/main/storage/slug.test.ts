import { describe, it, expect } from 'vitest';
import { noteFilename } from './slug';

describe('noteFilename', () => {
  it('uses the note id directly', () => {
    expect(noteFilename('1234abcd-5678-90ef-1234-567890abcdef')).toBe(
      '1234abcd-5678-90ef-1234-567890abcdef.md',
    );
  });
});
