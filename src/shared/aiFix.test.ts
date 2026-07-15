import { describe, it, expect } from 'vitest';
import type { AiFixSuggestion } from './ai';
import { isAutoApplyable, partitionFixSuggestions } from './aiFix';

function suggestion(overrides: Partial<AiFixSuggestion> = {}): AiFixSuggestion {
  return {
    id: 'fix-1',
    title: 'Fix a typo',
    category: 'spelling',
    severity: 'low',
    rationale: 'Corrects a misspelling.',
    confidence: 0.95,
    autoApplyable: true,
    target: { startLine: 1, endLine: 1, before: 'teh cat' },
    replacement: 'the cat',
    ...overrides,
  };
}

describe('isAutoApplyable', () => {
  it('accepts a high-confidence spelling fix with a concrete target', () => {
    expect(isAutoApplyable(suggestion())).toBe(true);
  });

  it('accepts a high-confidence capitalization fix', () => {
    expect(isAutoApplyable(suggestion({ category: 'capitalization' }))).toBe(true);
  });

  it('rejects when autoApplyable is false', () => {
    expect(isAutoApplyable(suggestion({ autoApplyable: false }))).toBe(false);
  });

  it('rejects non-spelling/capitalization categories', () => {
    expect(isAutoApplyable(suggestion({ category: 'formatting' }))).toBe(false);
    expect(isAutoApplyable(suggestion({ category: 'other' }))).toBe(false);
  });

  it('rejects low-confidence edits', () => {
    expect(isAutoApplyable(suggestion({ confidence: 0.79 }))).toBe(false);
  });

  it('rejects edits without a body target', () => {
    expect(isAutoApplyable(suggestion({ target: undefined }))).toBe(false);
  });

  it('rejects edits without a non-empty replacement', () => {
    expect(isAutoApplyable(suggestion({ replacement: '   ' }))).toBe(false);
    expect(isAutoApplyable(suggestion({ replacement: undefined }))).toBe(false);
  });

  it('rejects label suggestions regardless of confidence', () => {
    expect(
      isAutoApplyable(
        suggestion({
          category: 'label',
          label: 'work',
          target: undefined,
          replacement: undefined,
          autoApplyable: true,
        }),
      ),
    ).toBe(false);
  });
});

describe('partitionFixSuggestions', () => {
  it('splits auto-applicable edits from the review set', () => {
    const auto = suggestion({ id: 'a' });
    const formatting = suggestion({
      id: 'b',
      category: 'formatting',
      autoApplyable: false,
    });
    const label = suggestion({
      id: 'c',
      category: 'label',
      label: 'ideas',
      target: undefined,
      replacement: undefined,
      autoApplyable: false,
    });

    const { autoApply, review } = partitionFixSuggestions([auto, formatting, label]);

    expect(autoApply.map((s) => s.id)).toEqual(['a']);
    expect(review.map((s) => s.id)).toEqual(['b', 'c']);
  });

  it('returns empty partitions for an empty input', () => {
    expect(partitionFixSuggestions([])).toEqual({ autoApply: [], review: [] });
  });
});
