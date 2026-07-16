// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@primer/react';
import type { Label } from '@shared/note-labels';
import { EditorToolbar } from './EditorToolbar';

afterEach(cleanup);

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    value: () => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
    configurable: true,
  });
});

const labels: Label[] = [{ id: 1, name: 'work', color: 'default' }];

function renderToolbar(viewSource: boolean, labelsEnabled = true, mermaidEnabled = true): void {
  render(
    <ThemeProvider>
      <EditorToolbar
        editor={null}
        viewSource={viewSource}
        onSelectEditor={() => {}}
        onSelectSource={() => {}}
        pinned={false}
        onSummarize={() => {}}
        onReview={() => {}}
        onTidy={() => {}}
        onTogglePin={() => {}}
        onCopyMarkdown={() => {}}
        onDelete={() => {}}
        onOpenFindReplace={() => {}}
        labelsEnabled={labelsEnabled}
        mermaidEnabled={mermaidEnabled}
        noteLabels={[]}
        allLabels={labels}
        onLabelsChange={() => {}}
        onCreateAndAssign={() => {}}
      />
    </ThemeProvider>,
  );
}

describe('EditorToolbar labels control placement', () => {
  it('renders an icon-only labels button in WYSIWYG mode', () => {
    renderToolbar(false);

    const labelsButton = screen.getByTestId('label-picker');
    expect(labelsButton.textContent).toBe('');
    expect(screen.getByRole('button', { name: 'Labels' })).toBe(labelsButton);
    expect(screen.getByRole('button', { name: 'Insert diagram' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(screen.getByTestId('fmt-table').compareDocumentPosition(labelsButton)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('does not render the labels button in source mode', () => {
    renderToolbar(true);

    expect(screen.queryByTestId('label-picker')).toBeNull();
  });

  it('does not render the labels button when labels are disabled', () => {
    renderToolbar(false, false);

    expect(screen.queryByTestId('label-picker')).toBeNull();
  });

  it('does not render the diagram button when Mermaid is disabled', () => {
    renderToolbar(false, true, false);

    expect(screen.queryByRole('button', { name: 'Insert diagram' })).toBeNull();
    expect(screen.queryByTestId('fmt-mermaid')).toBeNull();
  });
});
