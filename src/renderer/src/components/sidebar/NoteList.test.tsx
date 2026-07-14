// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@primer/react';
import type { NoteSummary } from '@shared/note';
import type { Label } from '@shared/note-labels';
import type { GroupBy } from '../../utils/groupNotes';
import { NoteList } from './NoteList';

afterEach(cleanup);

function summary(overrides: Partial<NoteSummary>): NoteSummary {
  return {
    id: 'id',
    title: 'Title',
    snippet: '',
    labels: [],
    pinned: false,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderList(
  summaries: NoteSummary[],
  options: {
    labels?: Label[];
    groupBy?: GroupBy;
    searching?: boolean;
    onTogglePin?: (summary: NoteSummary) => void;
  } = {},
): void {
  const { labels = [], groupBy = 'date', searching = false, onTogglePin = () => {} } = options;
  render(
    <ThemeProvider>
      <NoteList
        summaries={summaries}
        labels={labels}
        selectedId={undefined}
        groupBy={groupBy}
        searching={searching}
        onSelect={() => {}}
        onTogglePin={onTogglePin}
      />
    </ThemeProvider>,
  );
}

describe('NoteList', () => {
  // Regression: ActionList.GroupHeading requires an `as` heading level for a
  // list-role ActionList. Without it Primer throws a dev-only invariant, which
  // crashed the renderer to a white screen whenever a note was pinned.
  it('renders a Pinned section above date-grouped notes without crashing', () => {
    renderList([
      summary({ id: 'a', title: 'Pinned note', pinned: true }),
      summary({ id: 'b', title: 'Plain note', pinned: false }),
    ]);

    expect(screen.getByText('Pinned')).toBeDefined();
    expect(screen.getByText('Today')).toBeDefined();
    expect(screen.getByText('Pinned note')).toBeDefined();
    expect(screen.getByText('Plain note')).toBeDefined();
  });

  it('groups notes under a relative date heading by default', () => {
    renderList([summary({ id: 'a', title: 'Only note', pinned: false })]);

    expect(screen.getByText('Only note')).toBeDefined();
    expect(screen.getByText('Today')).toBeDefined();
    expect(screen.queryByText('Pinned')).toBeNull();
  });

  it('groups notes by label when grouping by label', () => {
    const labels: Label[] = [{ id: 1, name: 'work', color: 'blue' }];
    renderList(
      [
        summary({ id: 'a', title: 'Work note', labels: ['work'] }),
        summary({ id: 'b', title: 'Loose note', labels: [] }),
      ],
      { labels, groupBy: 'label' },
    );

    expect(screen.getByText('work')).toBeDefined();
    expect(screen.getByText('No label')).toBeDefined();
    expect(screen.getByText('Work note')).toBeDefined();
  });

  it('renders a flat list without date sections while searching', () => {
    renderList([summary({ id: 'a', title: 'Match note' })], { searching: true });

    expect(screen.getByText('Match note')).toBeDefined();
    expect(screen.queryByText('Today')).toBeNull();
  });

  it('exposes a pin action per row and toggles without selecting the note', () => {
    const onTogglePin = vi.fn();
    const note = summary({ id: 'a', title: 'Pin me', pinned: false });
    renderList([note], { onTogglePin });

    const action = screen.getByRole('button', { name: 'Pin note' });
    action.click();
    expect(onTogglePin).toHaveBeenCalledWith(note);
  });

  it('offers an unpin action for pinned notes', () => {
    renderList([summary({ id: 'a', title: 'Pinned', pinned: true })]);

    expect(screen.getByRole('button', { name: 'Unpin note' })).toBeDefined();
  });
});
