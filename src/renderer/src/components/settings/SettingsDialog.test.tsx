// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@primer/react';
import { SettingsDialog } from './SettingsDialog';
import type { AppSettings } from '@shared/types';

const settings: AppSettings = {
  colorMode: 'auto',
  features: { labels: true, mermaid: true },
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
});

afterEach(cleanup);

function renderSettings(onFeatureChange = vi.fn()): void {
  render(
    <ThemeProvider>
      <SettingsDialog
        settings={settings}
        labels={[]}
        onClose={() => {}}
        onFeatureChange={onFeatureChange}
        onLabelsChanged={() => {}}
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
});
