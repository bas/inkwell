// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { InkwellApi } from '@shared/ipc';
import type { AppSettings } from '@shared/types';
import type { Note } from '@shared/note';
import { useAppSettings } from './useAppSettings';

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve: (value: T) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

const gitStatus = {
  available: { git: true, gh: true },
  settings: { enabled: false, autoCommit: 'onSave' as const, intervalMinutes: 5 },
  syncState: 'disabled' as const,
  dirty: false,
};

const loadedSettings: AppSettings = {
  colorMode: 'auto',
  features: { labels: true, mermaid: true },
  git: { enabled: false, autoCommit: 'onSave', intervalMinutes: 5 },
};

function note(): Note {
  return {
    id: 'n1',
    title: 'Settings note',
    body: 'Body',
    labels: [],
    pinned: false,
    createdAt: '2026-06-15T12:00:00.000Z',
    updatedAt: '2026-06-15T12:00:00.000Z',
  };
}

function installApi(overrides: Partial<InkwellApi> = {}): InkwellApi {
  const loadedNote = note();
  const api: InkwellApi = {
    getSettings: vi.fn(async () => loadedSettings),
    setColorMode: vi.fn(async (mode) => ({ ...loadedSettings, colorMode: mode })),
    setFeatureEnabled: vi.fn(async (feature, enabled) => ({
      ...loadedSettings,
      features: { ...loadedSettings.features, [feature]: enabled },
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
      summary: 'No suggestions.',
      suggestions: [],
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

function SettingsHarness(): JSX.Element {
  const { loaded, settings, error, setPreference, setFeatureEnabled } = useAppSettings();
  return (
    <div>
      <span data-testid="loaded">{loaded ? 'loaded' : 'loading'}</span>
      <span data-testid="mode">{settings.colorMode}</span>
      <span data-testid="labels">{settings.features.labels ? 'on' : 'off'}</span>
      <span data-testid="mermaid">{settings.features.mermaid ? 'on' : 'off'}</span>
      <span data-testid="error">{error ?? 'none'}</span>
      <button type="button" onClick={() => setPreference('dark')}>
        Dark
      </button>
      <button type="button" onClick={() => setFeatureEnabled('labels', false)}>
        Disable labels
      </button>
      <button type="button" onClick={() => setFeatureEnabled('mermaid', false)}>
        Disable Mermaid
      </button>
    </div>
  );
}

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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useAppSettings', () => {
  it('does not let initial settings load overwrite a newer preference update', async () => {
    const initialLoad = deferred<AppSettings>();
    installApi({
      getSettings: vi.fn(() => initialLoad.promise),
    });

    render(<SettingsHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));

    await waitFor(() => expect(screen.getByTestId('mode').textContent).toBe('dark'));

    await act(async () => {
      initialLoad.resolve(loadedSettings);
      await initialLoad.promise;
    });

    expect(screen.getByTestId('loaded').textContent).toBe('loaded');
    expect(screen.getByTestId('mode').textContent).toBe('dark');
    expect(screen.getByTestId('error').textContent).toBe('none');
  });

  it('ignores stale failed-write resyncs after a newer feature update starts', async () => {
    const resync = deferred<AppSettings>();
    const api = installApi({
      getSettings: vi
        .fn()
        .mockResolvedValueOnce(loadedSettings)
        .mockReturnValueOnce(resync.promise),
      setColorMode: vi.fn(async () => {
        throw new Error('Could not save settings');
      }),
    });

    render(<SettingsHarness />);

    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('loaded'));

    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));

    await waitFor(() => expect(api.getSettings).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole('button', { name: 'Disable labels' }));

    await waitFor(() => expect(screen.getByTestId('labels').textContent).toBe('off'));
    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('none'));

    await act(async () => {
      resync.resolve(loadedSettings);
      await resync.promise;
    });

    expect(screen.getByTestId('mode').textContent).toBe('dark');
    expect(screen.getByTestId('labels').textContent).toBe('off');
    expect(screen.getByTestId('error').textContent).toBe('none');
  });

  it('optimistically updates the Mermaid feature independently', async () => {
    const api = installApi();

    render(<SettingsHarness />);

    await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('loaded'));

    fireEvent.click(screen.getByRole('button', { name: 'Disable Mermaid' }));

    await waitFor(() => expect(screen.getByTestId('mermaid').textContent).toBe('off'));
    expect(screen.getByTestId('labels').textContent).toBe('on');
    expect(api.setFeatureEnabled).toHaveBeenCalledWith('mermaid', false);
  });
});
