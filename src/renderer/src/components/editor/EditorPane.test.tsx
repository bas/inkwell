// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@primer/react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditorPane } from './EditorPane';
import type { InkwellApi } from '@shared/ipc';
import type { Note } from '@shared/note';
import type { AiReviewState } from '../../state/useAiReview';

vi.mock('../../editor/MarkdownEditor', () => ({
  MarkdownEditor: (): JSX.Element => <div data-testid="markdown-editor" />,
}));

vi.mock('./EditorToolbar', () => ({
  EditorToolbar: ({ onReview }: { onReview: () => void }): JSX.Element => (
    <button type="button" data-testid="action-review" onClick={onReview}>
      Review with Copilot
    </button>
  ),
}));

vi.mock('./AiReviewPanel', () => ({
  AiReviewPanel: ({
    state,
    onApply,
  }: {
    state: AiReviewState;
    onApply: (id: string) => void;
  }): JSX.Element => (
    <aside data-testid="review-panel">
      {state.suggestions.map((suggestion) => (
        <div key={suggestion.id} data-testid={`review-item-${suggestion.id}`}>
          <span data-testid={`review-status-${suggestion.id}`}>{suggestion.status}</span>
          {suggestion.status === 'pending' && (
            <button type="button" data-testid="review-apply" onClick={() => onApply(suggestion.id)}>
              Apply
            </button>
          )}
        </div>
      ))}
    </aside>
  ),
}));

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
  }

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
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: () => 'request-1',
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n1',
    title: 'Review note',
    body: 'Original body text.',
    labels: [],
    pinned: false,
    createdAt: '2026-06-15T12:00:00.000Z',
    updatedAt: '2026-06-15T12:00:00.000Z',
    ...overrides,
  };
}

function installApi(overrides: Partial<InkwellApi> = {}): InkwellApi {
  const loadedNote = note();
  const api: InkwellApi = {
    getSettings: vi.fn(async () => ({ colorMode: 'auto' as const })),
    setColorMode: vi.fn(async (mode) => ({ colorMode: mode })),
    onSystemColorSchemeChanged: vi.fn(() => () => {}),
    listNotes: vi.fn(async () => []),
    searchNotes: vi.fn(async () => []),
    getNote: vi.fn(async () => loadedNote),
    createNote: vi.fn(async () => loadedNote),
    updateNote: vi.fn(async () => loadedNote),
    deleteNote: vi.fn(async () => undefined),
    onNotesChanged: vi.fn(() => () => {}),
    listLabels: vi.fn(async () => []),
    createLabel: vi.fn(async () => ({ id: 1, name: 'label', color: 'default' })),
    setLabelColor: vi.fn(async () => undefined),
    deleteLabel: vi.fn(async () => undefined),
    writeClipboard: vi.fn(async () => undefined),
    getAiAvailability: vi.fn(async () => ({ ready: true as const })),
    summarizeNote: vi.fn(async () => ({
      ok: true as const,
      requestId: 'request-1',
      content: 'Summary',
    })),
    cancelSummarize: vi.fn(async () => undefined),
    insertTldr: vi.fn(async () => loadedNote),
    reviewNote: vi.fn(async () => ({
      ok: true as const,
      requestId: 'request-1',
      summary: 'One suggestion.',
      suggestions: [
        {
          id: 's1',
          title: 'Improve clarity',
          category: 'clarity' as const,
          severity: 'low' as const,
          rationale: 'Clearer wording reads better.',
          confidence: 0.9,
          replacement: 'Improved body text.',
          target: {
            startLine: 1,
            endLine: 1,
            before: 'Original body text.',
          },
        },
      ],
    })),
    cancelReview: vi.fn(async () => undefined),
    applyReviewSuggestion: vi.fn(async () => ({
      note: loadedNote,
      apply: {
        ok: false as const,
        noteId: 'n1',
        suggestionId: 's1',
        reason: 'outdated' as const,
      },
    })),
    onAiStreamDelta: vi.fn(() => () => {}),
    onMenuNewNote: vi.fn(() => () => {}),
    ...overrides,
  };
  Object.defineProperty(window, 'api', { value: api, configurable: true });
  return api;
}

function renderEditor(): void {
  render(
    <ThemeProvider>
      <EditorPane
        noteId="n1"
        labels={[]}
        onAfterChange={() => {}}
        onLabelsChanged={() => {}}
        onAfterDelete={() => {}}
      />
    </ThemeProvider>,
  );
}

async function openReview(): Promise<void> {
  renderEditor();
  fireEvent.click(await screen.findByTestId('action-review'));
  await screen.findByTestId('review-panel');
  await waitFor(() => expect(screen.getByTestId('review-status-s1').textContent).toBe('pending'));
}

describe('EditorPane AI review apply errors', () => {
  beforeEach(() => {
    installApi();
  });

  it('keeps the suggestion pending and surfaces the storage error when apply throws', async () => {
    window.api.applyReviewSuggestion = vi.fn(async () => {
      throw new Error('Disk full');
    });

    await openReview();
    fireEvent.click(screen.getByTestId('review-apply'));

    await screen.findByText('Disk full');
    expect(screen.getByTestId('review-status-s1').textContent).toBe('pending');
  });

  it('marks the suggestion outdated when apply returns a stale-target result', async () => {
    await openReview();
    fireEvent.click(screen.getByTestId('review-apply'));

    await waitFor(() =>
      expect(screen.getByTestId('review-status-s1').textContent).toBe('outdated'),
    );
  });
});
