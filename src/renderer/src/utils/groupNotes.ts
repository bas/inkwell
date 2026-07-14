import type { NoteSummary } from '@shared/note';

/** How the notes list is sectioned in the sidebar. */
export type GroupBy = 'date' | 'label';

/** A titled section of notes rendered in the list. */
export interface NoteGroup {
  /** Stable key for React and persistence. */
  key: string;
  /** Human-readable section heading. */
  heading: string;
  notes: NoteSummary[];
}

const MS_DAY = 86_400_000;

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Bucket notes into relative date sections: Today, Previous 7 days (excluding
 * today), Previous 30 days (excluding the last 7), then older notes grouped by
 * month. Input order is preserved within each section, so callers should pass
 * notes already sorted newest-first.
 */
export function groupNotesByDate(notes: NoteSummary[], now: number = Date.now()): NoteGroup[] {
  const today = startOfDay(now);
  const last7 = today - 7 * MS_DAY;
  const last30 = today - 30 * MS_DAY;

  const buckets = new Map<string, NoteGroup>();
  const push = (key: string, heading: string, note: NoteSummary): void => {
    let group = buckets.get(key);
    if (!group) {
      group = { key, heading, notes: [] };
      buckets.set(key, group);
    }
    group.notes.push(note);
  };

  for (const note of notes) {
    const parsed = Date.parse(note.updatedAt);
    const day = Number.isNaN(parsed) ? 0 : startOfDay(parsed);
    if (day >= today) push('today', 'Today', note);
    else if (day >= last7) push('last-7', 'Previous 7 days', note);
    else if (day >= last30) push('last-30', 'Previous 30 days', note);
    else {
      const d = new Date(day || parsed);
      push(
        `m-${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`,
        d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
        note,
      );
    }
  }

  const result: NoteGroup[] = [];
  for (const key of ['today', 'last-7', 'last-30']) {
    const group = buckets.get(key);
    if (group) result.push(group);
  }
  const months = [...buckets.values()].filter((group) => group.key.startsWith('m-'));
  months.sort((a, b) => (a.key < b.key ? 1 : -1)); // newest month first
  result.push(...months);
  return result;
}

/**
 * Group notes under each of their labels, following `labelOrder` for section
 * order. Notes with multiple labels appear under each; unlabelled notes fall
 * into a trailing "No label" section.
 */
export function groupNotesByLabel(notes: NoteSummary[], labelOrder: string[]): NoteGroup[] {
  const groups = new Map<string, NoteGroup>();
  for (const name of labelOrder) {
    groups.set(name, { key: `label-${name}`, heading: name, notes: [] });
  }
  const unlabelled: NoteGroup = { key: 'no-label', heading: 'No label', notes: [] };

  for (const note of notes) {
    if (note.labels.length === 0) {
      unlabelled.notes.push(note);
      continue;
    }
    for (const name of note.labels) {
      let group = groups.get(name);
      if (!group) {
        group = { key: `label-${name}`, heading: name, notes: [] };
        groups.set(name, group);
      }
      group.notes.push(note);
    }
  }

  const result = [...groups.values()].filter((group) => group.notes.length > 0);
  if (unlabelled.notes.length > 0) result.push(unlabelled);
  return result;
}
