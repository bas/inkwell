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
  EditorToolbar: ({
    onReview,
    onSelectSource,
  }: {
    onReview: () => void;
    onSelectSource: () => void;
  }): JSX.Element => (
    <div data-testid="editor-toolbar">
      <button type="button" data-testid="action-review" onClick={onReview}>
        Review with Copilot
      </button>
      <button type="button" data-testid="action-source" onClick={onSelectSource}>
        Source
      </button>
    </div>
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

const gitStatus = {
  available: { git: true, gh: true },
  settings: { enabled: false, autoCommit: 'onSave' as const, intervalMinutes: 5 },
  syncState: 'disabled' as const,
  dirty: false,
};

function installApi(overrides: Partial<InkwellApi> = {}): InkwellApi {
  const loadedNote = note();
  const api: InkwellApi = {
    getSettings: vi.fn(async () => ({
      colorMode: 'auto' as const,
      aiModel: 'auto',
      features: { labels: true, mermaid: true },
      git: { enabled: false as const, autoCommit: 'onSave' as const, intervalMinutes: 5 },
    })),
    setColorMode: vi.fn(async (mode) => ({
      colorMode: mode,
      aiModel: 'auto',
      features: { labels: true, mermaid: true },
      git: { enabled: false as const, autoCommit: 'onSave' as const, intervalMinutes: 5 },
    })),
    setFeatureEnabled: vi.fn(async (feature, enabled) => ({
      colorMode: 'auto' as const,
      aiModel: 'auto',
      features: {
        labels: feature === 'labels' ? enabled : true,
        mermaid: feature === 'mermaid' ? enabled : true,
      },
      git: { enabled: false as const, autoCommit: 'onSave' as const, intervalMinutes: 5 },
    })),
    getAiModelPreference: vi.fn(async () => 'auto'),
    setAiModelPreference: vi.fn(async () => ({
      colorMode: 'auto' as const,
      aiModel: 'auto',
      features: { labels: true, mermaid: true },
      git: { enabled: false as const, autoCommit: 'onSave' as const, intervalMinutes: 5 },
    })),
    getVaultPath: vi.fn(async () => '/Users/test/Inkwell'),
    chooseVaultLocation: vi.fn(async () => ({ changed: false }) as const),
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
    listAiModels: vi.fn(async () => ({ models: [] })),
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
    fixNote: vi.fn(async () => ({
      ok: true as const,
      requestId: 'request-1',
      summary: 'Nothing to tidy.',
      suggestions: [],
    })),
    cancelFix: vi.fn(async () => undefined),
    applyFixSuggestion: vi.fn(async () => ({
      note: loadedNote,
      apply: {
        ok: false as const,
        noteId: 'n1',
        suggestionId: 'fix-1',
        reason: 'outdated' as const,
      },
    })),
    onAiStreamDelta: vi.fn(() => () => {}),
    onMenuNewNote: vi.fn(() => () => {}),
    getGitStatus: vi.fn(async () => gitStatus),
    setGitEnabled: vi.fn(async () => gitStatus),
    setGitAutoCommit: vi.fn(async () => gitStatus),
    setGitAutoPush: vi.fn(async () => gitStatus),
    getGitDestinations: vi.fn(async () => ({ hosts: ['github.com'], owners: [], orgOwners: [] })),
    checkGitRepoName: vi.fn(async () => ({ available: true, normalized: 'inkwell-notes' })),
    setupGitRemote: vi.fn(async () => ({ pushState: 'clean' as const, status: gitStatus })),
    removeGitRemote: vi.fn(async () => gitStatus),
    gitPushNow: vi.fn(async () => ({ state: 'clean' as const, status: gitStatus })),
    onGitStatusChanged: vi.fn(() => () => {}),
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
        labelsEnabled
        mermaidEnabled
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

  it('renders save-state below the toolbar and above the editor body', async () => {
    renderEditor();
    const toolbar = await screen.findByTestId('editor-toolbar');
    const saveState = await screen.findByTestId('save-state');
    const editorBody = await screen.findByTestId('editor-body');

    expect(saveState.textContent?.startsWith('Updated ')).toBe(true);
    expect(
      toolbar.compareDocumentPosition(saveState) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      saveState.compareDocumentPosition(editorBody) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe('EditorPane stale-write retry', () => {
  async function editSource(): Promise<void> {
    renderEditor();
    await screen.findByTestId('editor-toolbar');
    fireEvent.click(screen.getByTestId('action-source'));
    const textarea = await screen.findByTestId('source-editor');
    fireEvent.change(textarea, { target: { value: 'Edited body text.' } });
  }

  it('refreshes baseUpdatedAt and retries once when the first write is stale', async () => {
    const original = note({ updatedAt: '2026-06-15T12:00:00.000Z' });
    const latest = note({ updatedAt: '2026-06-15T13:00:00.000Z' });
    // First getNote is the initial load (original base); the second is the
    // stale-write refresh that hands back the newer on-disk version.
    const getNote = vi.fn().mockResolvedValueOnce(original).mockResolvedValue(latest);
    const updateNote = vi
      .fn()
      .mockImplementationOnce(async () => {
        throw Object.assign(new Error('Note changed on disk'), { name: 'StaleNoteError' });
      })
      .mockImplementationOnce(async () => latest);
    installApi({ getNote, updateNote });

    await editSource();
    // Wait past the 700ms save debounce for the write + single retry to run.
    await waitFor(() => expect(updateNote).toHaveBeenCalledTimes(2), { timeout: 2000 });

    // First write used the originally-loaded base; the retry forwards the
    // refreshed on-disk updatedAt so the active editor wins.
    expect(updateNote.mock.calls[0]?.[0]).toMatchObject({
      id: 'n1',
      baseUpdatedAt: '2026-06-15T12:00:00.000Z',
    });
    expect(getNote).toHaveBeenCalledWith('n1');
    expect(updateNote.mock.calls[1]?.[0]).toMatchObject({
      id: 'n1',
      baseUpdatedAt: '2026-06-15T13:00:00.000Z',
    });
    await waitFor(() => expect(screen.getByTestId('save-state').textContent).toBe('Saved'));
  });

  it('surfaces the error without retrying a second time when the retry is also stale', async () => {
    const updateNote = vi.fn(async () => {
      throw Object.assign(new Error('Note changed on disk'), { name: 'StaleNoteError' });
    });
    installApi({ updateNote });

    await editSource();
    // One original attempt plus a single retry — never an unbounded loop.
    await waitFor(() => expect(updateNote).toHaveBeenCalledTimes(2), { timeout: 2000 });
    await waitFor(() => expect(screen.getByTestId('save-state').textContent).toBe('Save failed'));
  });
});
