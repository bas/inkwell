import { describe, it, expect } from 'vitest';
import type { NoteSummary } from '@shared/note';
import { groupNotesByDate, groupNotesByLabel } from './groupNotes';

function note(overrides: Partial<NoteSummary>): NoteSummary {
  return {
    id: 'id',
    title: 'Title',
    snippet: '',
    labels: [],
    pinned: false,
    updatedAt: '2026-06-13T12:00:00.000Z',
    ...overrides,
  };
}

describe('groupNotesByDate', () => {
  const now = Date.parse('2026-06-20T12:00:00.000Z');

  it('buckets notes into relative date sections in a fixed order', () => {
    const groups = groupNotesByDate(
      [
        note({ id: 'today', updatedAt: '2026-06-20T09:00:00.000Z' }),
        note({ id: 'last-7', updatedAt: '2026-06-16T09:00:00.000Z' }),
        note({ id: 'last-30', updatedAt: '2026-06-02T09:00:00.000Z' }),
        note({ id: 'older', updatedAt: '2026-04-15T09:00:00.000Z' }),
      ],
      now,
    );

    expect(groups.map((group) => group.heading)).toEqual([
      'Today',
      'Previous 7 days',
      'Previous 30 days',
      'April 2026',
    ]);
  });

  it('omits empty sections and keeps newest month first', () => {
    const groups = groupNotesByDate(
      [
        note({ id: 'a', updatedAt: '2026-05-10T09:00:00.000Z' }),
        note({ id: 'b', updatedAt: '2026-03-10T09:00:00.000Z' }),
      ],
      now,
    );

    expect(groups.map((group) => group.heading)).toEqual(['May 2026', 'March 2026']);
  });

  it('preserves input order within a section', () => {
    const groups = groupNotesByDate(
      [
        note({ id: 'first', updatedAt: '2026-06-13T11:00:00.000Z' }),
        note({ id: 'second', updatedAt: '2026-06-13T08:00:00.000Z' }),
      ],
      now,
    );

    expect(groups[0]!.notes.map((n) => n.id)).toEqual(['first', 'second']);
  });
});

describe('groupNotesByLabel', () => {
  it('groups by label following the provided order, multi-label notes repeat', () => {
    const groups = groupNotesByLabel(
      [
        note({ id: 'a', labels: ['work'] }),
        note({ id: 'b', labels: ['work', 'urgent'] }),
        note({ id: 'c', labels: [] }),
      ],
      ['urgent', 'work'],
    );

    expect(groups.map((group) => group.heading)).toEqual(['urgent', 'work', 'No label']);
    expect(groups[0]!.notes.map((n) => n.id)).toEqual(['b']);
    expect(groups[1]!.notes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(groups[2]!.notes.map((n) => n.id)).toEqual(['c']);
  });

  it('omits label sections with no notes', () => {
    const groups = groupNotesByLabel([note({ id: 'a', labels: ['work'] })], ['work', 'idea']);

    expect(groups.map((group) => group.heading)).toEqual(['work']);
  });
});
