import { describe, expect, it } from 'vitest';
import { buildReviewPrompt, buildSummarizePrompt, buildFixPrompt } from './prompts';

describe('buildSummarizePrompt', () => {
  it('embeds the trimmed note body between explicit delimiters', () => {
    const prompt = buildSummarizePrompt('  Hello world  ');
    expect(prompt).toContain('--- BEGIN NOTE ---\nHello world\n--- END NOTE ---');
  });

  it('instructs the model to return only a concise summary', () => {
    const prompt = buildSummarizePrompt('Body');
    expect(prompt).toMatch(/concise TL;DR/i);
    expect(prompt).toMatch(/only the summary/i);
  });

  it('does not leak note content into the instruction lines', () => {
    const prompt = buildSummarizePrompt('SECRET');
    const [firstLine] = prompt.split('\n');
    expect(firstLine).not.toContain('SECRET');
  });
});

describe('buildReviewPrompt', () => {
  it('includes strict JSON schema instructions and note delimiters', () => {
    const prompt = buildReviewPrompt('Body text');
    expect(prompt).toContain('Return strict JSON');
    expect(prompt).toContain('"suggestions"');
    expect(prompt).toContain('--- BEGIN NOTE ---\nBody text\n--- END NOTE ---');
  });

  it('embeds scoped line-range instruction when provided', () => {
    const prompt = buildReviewPrompt('Line 1\nLine 2', { scope: { startLine: 1, endLine: 1 } });
    expect(prompt).toContain('Focus only on lines 1-1.');
  });
});

describe('buildFixPrompt', () => {
  it('includes strict JSON schema instructions and note delimiters', () => {
    const prompt = buildFixPrompt('Body text', []);
    expect(prompt).toContain('Return strict JSON');
    expect(prompt).toContain('"suggestions"');
    expect(prompt).toContain('--- BEGIN NOTE ---\nBody text\n--- END NOTE ---');
  });

  it('constrains auto-apply to low-risk spelling/capitalization fixes', () => {
    const prompt = buildFixPrompt('Body', []);
    expect(prompt).toMatch(/autoApplyable.*true ONLY/i);
    expect(prompt).toContain(
      'Categories allowed: spelling, capitalization, formatting, label, other.',
    );
  });

  it('lists existing labels to reuse when present', () => {
    const prompt = buildFixPrompt('Body', ['work', 'ideas']);
    expect(prompt).toContain('Existing labels you should prefer to reuse: work, ideas.');
  });

  it('notes when there are no existing labels', () => {
    const prompt = buildFixPrompt('Body', []);
    expect(prompt).toContain('There are no existing labels yet.');
  });

  it('does not leak note content into the instruction lines', () => {
    const prompt = buildFixPrompt('SECRET', []);
    const [firstLine] = prompt.split('\n');
    expect(firstLine).not.toContain('SECRET');
  });
});
