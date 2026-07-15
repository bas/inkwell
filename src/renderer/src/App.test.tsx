// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';

vi.mock('./hooks/useAppSettings', () => ({
  useAppSettings: () => ({
    settings: { colorMode: 'auto', features: { labels: true, mermaid: true } },
    preference: 'auto',
    resolvedMode: 'light',
    loaded: true,
    error: undefined,
    setPreference: vi.fn(),
    setFeatureEnabled: vi.fn(),
  }),
  toPrimerColorMode: () => 'day',
}));

vi.mock('./state/useNotes', () => ({
  useNotes: () => ({
    summaries: [],
    labels: [],
    selectedId: undefined,
    query: '',
    loading: false,
    error: undefined,
    setQuery: vi.fn(),
    select: vi.fn(),
    createNote: vi.fn(async () => undefined),
    togglePin: vi.fn(async () => undefined),
    refresh: vi.fn(async () => undefined),
    refreshLabels: vi.fn(async () => undefined),
  }),
}));

vi.mock('./components/sidebar/Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar">Sidebar</div>,
}));

vi.mock('./components/editor/EditorPane', () => ({
  EditorPane: () => <div data-testid="editor-pane">Editor</div>,
}));

vi.mock('./components/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">Theme toggle</div>,
}));

vi.mock('./components/settings/SettingsDialog', () => ({
  SettingsDialog: () => <div data-testid="settings-dialog">Settings</div>,
}));

function setViewportWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    value: width,
    configurable: true,
    writable: true,
  });
}

describe('App narrow sidebar behavior', () => {
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
    class MockResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    Object.defineProperty(window, 'ResizeObserver', {
      value: MockResizeObserver,
      configurable: true,
    });
  });

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('auto-hides the sidebar when entering narrow mode and allows toggling it back', () => {
    setViewportWidth(900);
    render(<App />);

    expect(screen.getByTestId('sidebar')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Hide notes list' })).toBeDefined();

    setViewportWidth(760);
    fireEvent(window, new Event('resize'));

    expect(screen.queryByTestId('sidebar')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show notes list' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Show notes list' }));
    expect(screen.getByTestId('sidebar')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Hide notes list' })).toBeDefined();
  });

  it('restores regular-mode visibility preference after leaving narrow mode', () => {
    setViewportWidth(900);
    render(<App />);

    setViewportWidth(760);
    fireEvent(window, new Event('resize'));
    expect(screen.queryByTestId('sidebar')).toBeNull();

    setViewportWidth(900);
    fireEvent(window, new Event('resize'));
    expect(screen.getByTestId('sidebar')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Hide notes list' })).toBeDefined();
  });
});
