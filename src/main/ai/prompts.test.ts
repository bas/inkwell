import { describe, expect, it } from 'vitest';
import { buildSummarizePrompt } from './prompts';

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
