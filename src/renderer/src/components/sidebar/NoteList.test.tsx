// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@primer/react';
import type { NoteSummary } from '@shared/note';
import type { Label } from '@shared/note-labels';
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

function renderList(summaries: NoteSummary[], labels: Label[] = []): void {
  render(
    <ThemeProvider>
      <NoteList summaries={summaries} labels={labels} selectedId={undefined} onSelect={() => {}} />
    </ThemeProvider>,
  );
}

describe('NoteList', () => {
  // Regression: ActionList.GroupHeading requires an `as` heading level for a
  // list-role ActionList. Without it Primer throws a dev-only invariant, which
  // crashed the renderer to a white screen whenever a note was pinned.
  it('renders pinned and unpinned groups without crashing', () => {
    renderList([
      summary({ id: 'a', title: 'Pinned note', pinned: true }),
      summary({ id: 'b', title: 'Plain note', pinned: false }),
    ]);

    expect(screen.getByText('Pinned')).toBeDefined();
    expect(screen.getByText('Pinned note')).toBeDefined();
    expect(screen.getByText('Plain note')).toBeDefined();
  });

  it('renders an unpinned-only list without a group heading', () => {
    renderList([summary({ id: 'a', title: 'Only note', pinned: false })]);

    expect(screen.getByText('Only note')).toBeDefined();
    expect(screen.queryByText('Pinned')).toBeNull();
  });
});
