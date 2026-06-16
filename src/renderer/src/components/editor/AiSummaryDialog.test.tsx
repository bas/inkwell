// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@primer/react';
import { AiSummaryDialog } from './AiSummaryDialog';
import type { AiSummaryState } from '../../state/useAiSummary';

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
  }
});

afterEach(cleanup);

describe('AiSummaryDialog', () => {
  it('uses the shared markdown alignment class on summary content', () => {
    const state: AiSummaryState = { status: 'done', text: '- one\n1. two\n> quote' };

    render(
      <ThemeProvider>
        <AiSummaryDialog
          state={state}
          noteTitle="Note"
          inserting={false}
          onClose={vi.fn()}
          onStop={vi.fn()}
          onRetry={vi.fn()}
          onInsert={vi.fn()}
        />
      </ThemeProvider>,
    );

    const content = screen.getByTestId('ai-summary-text');
    expect(content.className).toContain('markdown-body');
    expect(content.className).toContain('ink-markdown-aligned');
  });
});
