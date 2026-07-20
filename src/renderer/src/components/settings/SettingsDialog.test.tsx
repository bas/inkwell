// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@primer/react';
import { SettingsDialog } from './SettingsDialog';
import type { AppSettings } from '@shared/types';

const settings: AppSettings = {
  colorMode: 'auto',
  aiModel: 'auto',
  features: { labels: true, mermaid: true },
  git: { enabled: false, autoCommit: 'onSave', intervalMinutes: 5 },
};

const gitStatus = {
  available: { git: true, gh: true },
  settings: { enabled: false, autoCommit: 'onSave' as const, intervalMinutes: 5 },
  syncState: 'disabled' as const,
  dirty: false,
};

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

  // BackupSettingsSection reads backup status via the preload bridge on mount.
  Object.defineProperty(window, 'api', {
    value: {
      getGitStatus: () => Promise.resolve(gitStatus),
      onGitStatusChanged: () => () => {},
      getVaultPath: () => Promise.resolve('/Users/test/Inkwell'),
      chooseVaultLocation: () => Promise.resolve({ changed: false }),
    },
    configurable: true,
  });
});

afterEach(cleanup);

function renderSettings(onFeatureChange = vi.fn()): void {
  render(
    <ThemeProvider>
      <SettingsDialog
        settings={settings}
        aiModels={[
          { id: 'gpt-5.4', label: 'GPT-5.4' },
          { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
        ]}
        aiModelsLoading={false}
        labels={[]}
        onClose={() => {}}
        onFeatureChange={onFeatureChange}
        onLabelsChanged={() => {}}
        onAiModelChange={() => {}}
      />
    </ThemeProvider>,
  );
}

describe('SettingsDialog', () => {
  it('renders a Mermaid feature toggle that updates the mermaid feature', () => {
    const onFeatureChange = vi.fn();
    renderSettings(onFeatureChange);

    const toggle = screen.getByTestId('feature-mermaid-toggle');
    expect(toggle.getAttribute('type')).toBe('checkbox');
    expect((toggle as HTMLInputElement).checked).toBe(true);

    fireEvent.click(toggle);

    expect(onFeatureChange).toHaveBeenCalledWith('mermaid', false);
  });

  it('renders the Notes vault section with the current path and a change button', async () => {
    renderSettings();

    const path = await screen.findByTestId('vault-current-path');
    expect(path.textContent).toBe('/Users/test/Inkwell');
    expect(screen.getByTestId('vault-change-location')).toBeTruthy();
  });

  it('renders the AI model select with auto and discovered options', () => {
    renderSettings();
    const select = screen.getByTestId('ai-model-select') as HTMLSelectElement;
    const options = Array.from(select.options).map((option) => option.value);
    expect(options).toEqual(['auto', 'gpt-5.4', 'claude-sonnet-5']);
  });
});
