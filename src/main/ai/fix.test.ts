import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}));

import { parseFixResponse } from './fix';

describe('parseFixResponse', () => {
  it('parses a well-formed tidy response', () => {
    const raw = JSON.stringify({
      summary: 'Tidied the note.',
      suggestions: [
        {
          id: 's1',
          title: 'Fix typo',
          category: 'spelling',
          severity: 'low',
          rationale: 'Corrects a misspelling.',
          confidence: 0.95,
          autoApplyable: true,
          replacement: 'the cat',
          target: { startLine: 1, endLine: 1, before: 'teh cat' },
        },
      ],
    });

    const parsed = parseFixResponse(raw);

    expect(parsed.summary).toBe('Tidied the note.');
    expect(parsed.suggestions).toHaveLength(1);
    const [s] = parsed.suggestions;
    expect(s).toMatchObject({
      id: 's1',
      category: 'spelling',
      autoApplyable: true,
      replacement: 'the cat',
    });
  });

  it('parses a label suggestion without a body target', () => {
    const raw = JSON.stringify({
      summary: 'Suggested a label.',
      suggestions: [
        {
          id: 'l1',
          title: 'Add label',
          category: 'label',
          severity: 'low',
          rationale: 'Groups related notes.',
          confidence: 0.6,
          autoApplyable: true,
          label: 'work',
        },
      ],
    });

    const [s] = parseFixResponse(raw).suggestions;
    expect(s!.category).toBe('label');
    expect(s!.label).toBe('work');
    // Label suggestions can never be auto-applied.
    expect(s!.autoApplyable).toBe(false);
    expect(s!.target).toBeUndefined();
  });

  it('drops body suggestions missing a target or replacement', () => {
    const raw = JSON.stringify({
      summary: 'Partial.',
      suggestions: [
        { id: 'a', category: 'formatting', title: 'No target', replacement: 'x' },
        {
          id: 'b',
          category: 'formatting',
          title: 'No replacement',
          target: { startLine: 1, endLine: 1 },
        },
        {
          id: 'c',
          category: 'formatting',
          title: 'Valid',
          replacement: '# Heading',
          target: { startLine: 1, endLine: 1 },
        },
      ],
    });

    const ids = parseFixResponse(raw).suggestions.map((s) => s.id);
    expect(ids).toEqual(['c']);
  });

  it('drops label suggestions without a label name', () => {
    const raw = JSON.stringify({
      summary: 'x',
      suggestions: [{ id: 'l', category: 'label', title: 'Empty', label: '   ' }],
    });
    expect(parseFixResponse(raw).suggestions).toHaveLength(0);
  });

  it('clamps confidence into the 0..1 range', () => {
    const raw = JSON.stringify({
      summary: 'x',
      suggestions: [
        {
          id: 'a',
          category: 'other',
          title: 'Over',
          confidence: 5,
          replacement: 'y',
          target: { startLine: 1, endLine: 1 },
        },
      ],
    });
    expect(parseFixResponse(raw).suggestions[0]!.confidence).toBe(1);
  });

  it('parses JSON wrapped in a Markdown code fence', () => {
    const inner = {
      summary: 'Tidied.',
      suggestions: [
        {
          id: 's1',
          title: 'Fix typo',
          category: 'spelling',
          severity: 'low',
          rationale: 'x',
          confidence: 0.9,
          autoApplyable: true,
          replacement: 'the cat',
          target: { startLine: 1, endLine: 1, before: 'teh cat' },
        },
      ],
    };
    const raw = '```json\n' + JSON.stringify(inner, null, 2) + '\n```';
    const parsed = parseFixResponse(raw);
    expect(parsed.summary).toBe('Tidied.');
    expect(parsed.suggestions).toHaveLength(1);
  });

  it('parses JSON with surrounding prose and a bare fence', () => {
    const raw =
      'Sure, here is the result:\n```\n{"summary":"ok","suggestions":[]}\n```\nHope that helps!';
    expect(parseFixResponse(raw).summary).toBe('ok');
  });

  it('throws on invalid JSON', () => {
    expect(() => parseFixResponse('not json')).toThrow();
  });

  it('throws when the response is entirely empty', () => {
    expect(() => parseFixResponse(JSON.stringify({ summary: '', suggestions: [] }))).toThrow();
  });
});
