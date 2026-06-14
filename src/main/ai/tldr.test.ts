import { describe, expect, it } from 'vitest';
import { upsertTldrBlock } from './tldr';

describe('upsertTldrBlock', () => {
  it('prepends a TL;DR blockquote above existing content', () => {
    const result = upsertTldrBlock('# Title\n\nBody text.', 'A short summary.');
    expect(result).toBe('> **TL;DR** — A short summary.\n\n# Title\n\nBody text.');
  });

  it('replaces an existing block instead of stacking (idempotent)', () => {
    const once = upsertTldrBlock('Original body.', 'First summary.');
    const twice = upsertTldrBlock(once, 'Updated summary.');
    expect(twice.match(/\*\*TL;DR\*\*/g)).toHaveLength(1);
    expect(twice).toContain('Updated summary.');
    expect(twice).not.toContain('First summary.');
    expect(twice).toContain('Original body.');
  });

  it('replaces the block even after a single-line WYSIWYG round-trip', () => {
    // tiptap collapses the multi-line blockquote into one line on save.
    const roundTripped = '> **TL;DR** — Line one. Line two.\n\nOriginal body.';
    const result = upsertTldrBlock(roundTripped, 'Fresh summary.');
    expect(result).toBe('> **TL;DR** — Fresh summary.\n\nOriginal body.');
  });

  it('replaces and heals a legacy HTML-comment sentinel block', () => {
    const legacy =
      '<!-- inkwell:tldr -->\n> **TL;DR** — Old.\n<!-- /inkwell:tldr -->\n\nKept body.';
    const result = upsertTldrBlock(legacy, 'New summary.');
    expect(result).toBe('> **TL;DR** — New summary.\n\nKept body.');
    expect(result).not.toContain('<!--');
  });

  it('quotes every line of a multi-line summary', () => {
    const result = upsertTldrBlock('Body', 'Line one.\nLine two.');
    expect(result).toContain('> **TL;DR** — Line one.\n> Line two.');
  });

  it('handles an empty body', () => {
    expect(upsertTldrBlock('', 'Only summary.')).toBe('> **TL;DR** — Only summary.\n');
  });
});
