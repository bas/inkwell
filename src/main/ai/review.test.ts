import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}));

vi.mock('./availability', () => ({
  getAiAvailability: vi.fn(),
}));

vi.mock('./prompts', () => ({
  buildReviewPrompt: vi.fn(),
}));

vi.mock('./runner', () => ({
  runGeneration: vi.fn(),
}));

import { parseReviewResponse } from './review';

describe('parseReviewResponse', () => {
  it('drops suggestions with inverted line ranges', () => {
    const payload = {
      summary: 'Review complete.',
      suggestions: [
        {
          id: 'bad-range',
          title: 'Bad range',
          category: 'clarity',
          severity: 'medium',
          rationale: 'Inverted.',
          target: { startLine: 4, endLine: 3 },
          replacement: 'Replacement.',
          confidence: 0.8,
        },
        {
          id: 'valid-range',
          title: 'Valid range',
          category: 'clarity',
          severity: 'medium',
          rationale: 'Valid.',
          target: { startLine: 1, endLine: 1 },
          replacement: 'Replacement.',
          confidence: 0.8,
        },
      ],
    };

    const result = parseReviewResponse(JSON.stringify(payload));

    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]?.id).toBe('valid-range');
  });
});
