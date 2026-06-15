import { describe, expect, it } from 'vitest';
import type { AiReviewSuggestion } from '../../shared/ai';
import { applyReviewSuggestionToBody } from './reviewApply';

function suggestion(overrides: Partial<AiReviewSuggestion> = {}): AiReviewSuggestion {
  return {
    id: 's1',
    title: 'Fix wording',
    category: 'clarity',
    severity: 'low',
    rationale: 'Clearer phrasing.',
    confidence: 0.9,
    replacement: 'Replacement line.',
    target: { startLine: 2, endLine: 2 },
    ...overrides,
  };
}

const BODY = ['First line.', 'Second line.', 'Third line.'].join('\n');

describe('applyReviewSuggestionToBody', () => {
  it('replaces an exact line range', () => {
    const result = applyReviewSuggestionToBody('n1', BODY, suggestion());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.updatedBody).toBe(
        ['First line.', 'Replacement line.', 'Third line.'].join('\n'),
      );
    }
  });

  it('replaces a multi-line range with multi-line replacement', () => {
    const result = applyReviewSuggestionToBody(
      'n1',
      BODY,
      suggestion({ target: { startLine: 1, endLine: 2 }, replacement: 'A\nB' }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.updatedBody).toBe(['A', 'B', 'Third line.'].join('\n'));
    }
  });

  it('marks suggestion outdated when the preimage no longer matches and no anchor exists', () => {
    const result = applyReviewSuggestionToBody(
      'n1',
      BODY,
      suggestion({ target: { startLine: 2, endLine: 2, before: 'Different content.' } }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('outdated');
    }
  });

  it('applies via anchor fallback when the line range is stale', () => {
    const result = applyReviewSuggestionToBody(
      'n1',
      BODY,
      suggestion({
        replacement: 'Renamed.',
        target: {
          startLine: 2,
          endLine: 2,
          before: 'Different content.',
          anchorText: 'Second line.',
        },
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.updatedBody).toBe(['First line.', 'Renamed.', 'Third line.'].join('\n'));
    }
  });

  it('uses the anchor when the line range is out of bounds', () => {
    const result = applyReviewSuggestionToBody(
      'n1',
      BODY,
      suggestion({
        replacement: 'Renamed.',
        target: { startLine: 99, endLine: 99, anchorText: 'Third line.' },
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.updatedBody).toBe(['First line.', 'Second line.', 'Renamed.'].join('\n'));
    }
  });

  it('reports outdated when an anchor is provided but not found', () => {
    const result = applyReviewSuggestionToBody(
      'n1',
      BODY,
      suggestion({ target: { startLine: 99, endLine: 99, anchorText: 'Missing.' } }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('outdated');
    }
  });

  it('reports invalid-target when neither a valid range nor anchor is available', () => {
    const result = applyReviewSuggestionToBody(
      'n1',
      BODY,
      suggestion({ target: { startLine: 99, endLine: 99 } }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid-target');
    }
  });
});
