import { describe, it, expect } from 'vitest';
import { relativeTime } from './relativeTime';

describe('relativeTime', () => {
  const now = Date.parse('2026-06-13T12:00:00.000Z');

  it('shows "just now" for recent times', () => {
    expect(relativeTime('2026-06-13T11:59:30.000Z', now)).toBe('just now');
  });

  it('shows minutes, hours, and days', () => {
    expect(relativeTime('2026-06-13T11:30:00.000Z', now)).toBe('30m');
    expect(relativeTime('2026-06-13T09:00:00.000Z', now)).toBe('3h');
    expect(relativeTime('2026-06-11T12:00:00.000Z', now)).toBe('2d');
  });

  it('returns empty string for invalid input', () => {
    expect(relativeTime('not-a-date', now)).toBe('');
  });
});
