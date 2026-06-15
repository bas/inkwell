import { describe, expect, it } from 'vitest';
import { buildReviewPrompt, buildSummarizePrompt } from './prompts';

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
