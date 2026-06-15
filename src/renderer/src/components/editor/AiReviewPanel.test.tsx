// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@primer/react';
import { AiReviewPanel } from './AiReviewPanel';
import { nextSelection } from '../../state/useAiReview';
import type { AiReviewState, UiReviewSuggestion } from '../../state/useAiReview';

beforeAll(() => {
  // Primer's Dialog relies on ResizeObserver, which jsdom does not implement.
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

function suggestion(overrides: Partial<UiReviewSuggestion> = {}): UiReviewSuggestion {
  return {
    id: 's1',
    title: 'Fix grammar',
    category: 'grammar',
    severity: 'high',
    rationale: 'Because.',
    confidence: 0.9,
    replacement: 'Fixed text.',
    target: { startLine: 1, endLine: 1, before: 'Broken text.' },
    status: 'pending',
    ...overrides,
  };
}

/** Minimal stateful host mirroring how EditorPane drives the panel. */
function Host({ initial }: { initial: UiReviewSuggestion[] }): JSX.Element {
  const [suggestions, setSuggestions] = useState(initial);
  const [selectedSuggestionId, setSelected] = useState(initial[0]?.id);
  const state: AiReviewState = {
    status: 'done',
    summary: 'Summary.',
    suggestions,
    selectedSuggestionId,
    streamingText: '',
  };
  const setStatus = (id: string, status: UiReviewSuggestion['status']): void => {
    const next = suggestions.map((s) => (s.id === id ? { ...s, status } : s));
    setSuggestions(next);
    if (selectedSuggestionId === id) setSelected(nextSelection(next, id));
  };
  return (
    <ThemeProvider>
      <AiReviewPanel
        state={state}
        noteTitle="Note"
        applyingId={undefined}
        batchApplying={false}
        onClose={() => {}}
        onCancel={() => {}}
        onRetry={() => {}}
        onSelect={setSelected}
        onApply={(id) => setStatus(id, 'applied')}
        onReject={(id) => setStatus(id, 'rejected')}
        onApplyBatch={(ids) => ids.forEach((id) => setStatus(id, 'applied'))}
        onRefine={() => {}}
      />
    </ThemeProvider>
  );
}

describe('AiReviewPanel status updates', () => {
  it('reflects a rejected status on the suggestion chip', () => {
    render(<Host initial={[suggestion()]} />);
    expect(screen.getByTestId('review-status-s1').textContent).toBe('Pending');
    fireEvent.click(screen.getByTestId('review-reject'));
    expect(screen.getByTestId('review-status-s1').textContent).toBe('Rejected');
  });

  it('reflects an applied status on the suggestion chip', () => {
    render(<Host initial={[suggestion()]} />);
    fireEvent.click(screen.getByTestId('review-apply'));
    expect(screen.getByTestId('review-status-s1').textContent).toBe('Applied');
  });

  it('hides apply/reject for a resolved suggestion and shows a resolved banner', () => {
    render(<Host initial={[suggestion()]} />);
    fireEvent.click(screen.getByTestId('review-apply'));
    expect(screen.queryByTestId('review-apply')).toBeNull();
    expect(screen.queryByTestId('review-reject')).toBeNull();
    expect(screen.getByTestId('review-resolved').textContent).toContain('Applied');
  });

  it('auto-advances selection to the next pending suggestion after resolving', () => {
    render(
      <Host
        initial={[
          suggestion({ id: 's1', title: 'First' }),
          suggestion({ id: 's2', title: 'Second' }),
        ]}
      />,
    );
    // s1 is selected first; rejecting it should move focus to s2's detail.
    fireEvent.click(screen.getByTestId('review-reject'));
    expect(screen.getByTestId('review-detail').textContent).toContain('Second');
    // s2 is still actionable.
    expect(screen.getByTestId('review-apply')).toBeTruthy();
  });

  it('shows reviewed progress in the header', () => {
    render(
      <Host
        initial={[
          suggestion({ id: 's1', title: 'First' }),
          suggestion({ id: 's2', title: 'Second' }),
        ]}
      />,
    );
    expect(screen.getByTestId('review-progress').textContent).toBe('2 pending · 0 reviewed');
    fireEvent.click(screen.getByTestId('review-reject'));
    expect(screen.getByTestId('review-progress').textContent).toBe('1 pending · 1 reviewed');
  });
});

describe('nextSelection', () => {
  const make = (id: string, status: UiReviewSuggestion['status']): UiReviewSuggestion =>
    suggestion({ id, status });

  it('advances to the next pending suggestion', () => {
    const list = [make('a', 'applied'), make('b', 'pending'), make('c', 'pending')];
    expect(nextSelection(list, 'a')).toBe('b');
  });

  it('wraps around to an earlier pending suggestion', () => {
    const list = [make('a', 'pending'), make('b', 'applied'), make('c', 'rejected')];
    expect(nextSelection(list, 'b')).toBe('a');
  });

  it('falls back to the resolved id when nothing is pending', () => {
    const list = [make('a', 'applied'), make('b', 'rejected')];
    expect(nextSelection(list, 'b')).toBe('b');
  });
});
