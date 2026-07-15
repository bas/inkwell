import { describe, expect, it } from 'vitest';
import { isLabelColor, normalizeLabelName } from './note-labels';

describe('label input helpers', () => {
  it('accepts only supported label colors', () => {
    expect(isLabelColor('default')).toBe(true);
    expect(isLabelColor('blue')).toBe(true);
    expect(isLabelColor('')).toBe(false);
    expect(isLabelColor('teal')).toBe(false);
    expect(isLabelColor(1)).toBe(false);
  });

  it('trims label names and rejects empty names', () => {
    expect(normalizeLabelName('  Work  ')).toBe('Work');
    expect(() => normalizeLabelName('   ')).toThrow('Label name cannot be empty');
  });
});
