import { describe, expect, it } from 'vitest';
import { upsertTldrBlock } from './tldr';

const START = '<!-- inkwell:tldr -->';
const END = '<!-- /inkwell:tldr -->';

describe('upsertTldrBlock', () => {
  it('prepends a sentinel-wrapped blockquote above existing content', () => {
    const result = upsertTldrBlock('# Title\n\nBody text.', 'A short summary.');
    expect(result).toBe(
      `${START}\n> **TL;DR** — A short summary.\n${END}\n\n# Title\n\nBody text.`,
    );
  });

  it('replaces an existing block instead of stacking (idempotent)', () => {
    const once = upsertTldrBlock('Original body.', 'First summary.');
    const twice = upsertTldrBlock(once, 'Updated summary.');
    expect(twice.match(new RegExp(START, 'g'))).toHaveLength(1);
    expect(twice).toContain('Updated summary.');
    expect(twice).not.toContain('First summary.');
    expect(twice).toContain('Original body.');
  });

  it('quotes every line of a multi-line summary', () => {
    const result = upsertTldrBlock('Body', 'Line one.\nLine two.');
    expect(result).toContain('> **TL;DR** — Line one.\n> Line two.');
  });

  it('handles an empty body', () => {
    expect(upsertTldrBlock('', 'Only summary.')).toBe(
      `${START}\n> **TL;DR** — Only summary.\n${END}\n`,
    );
  });
});
