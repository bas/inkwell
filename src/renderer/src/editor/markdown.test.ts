// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeMarkdown } from './markdown';

const fixturesDir = join(__dirname, '__fixtures__');

describe('markdown round-trip', () => {
  const fixtures = readdirSync(fixturesDir).filter((name) => name.endsWith('.md'));

  it('has golden fixtures to verify', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  for (const name of fixtures) {
    it(`round-trips ${name} without loss`, () => {
      const golden = readFileSync(join(fixturesDir, name), 'utf8');
      // Golden fixtures are already in normalized form, so the editor must
      // reproduce them exactly (idempotent round-trip).
      expect(normalizeMarkdown(golden)).toBe(golden.replace(/\n$/, ''));
    });
  }

  it('preserves common inline and block formatting', () => {
    const out = normalizeMarkdown(
      ['# Title', '', 'Some **bold** and *italic* and `code`.', '', '- one', '- two'].join('\n'),
    );
    expect(out).toContain('# Title');
    expect(out).toContain('**bold**');
    expect(out).toContain('*italic*');
    expect(out).toContain('`code`');
    expect(out).toContain('- one');
  });

  it('preserves links', () => {
    const out = normalizeMarkdown('See [Primer](https://primer.style).');
    expect(out).toBe('See [Primer](https://primer.style).');
  });
});
