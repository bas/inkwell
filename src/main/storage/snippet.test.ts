import { describe, it, expect } from 'vitest';
import { makeSnippet } from './snippet';

describe('makeSnippet', () => {
  it('skips the title line and strips formatting from the body preview', () => {
    expect(makeSnippet('Title\n\nSome **bold** and _italic_ text.')).toBe('Some bold and italic text.');
  });

  it('converts links to their text', () => {
    expect(makeSnippet('Title\n\nSee [Primer](https://primer.style) docs')).toBe('See Primer docs');
  });

  it('removes fenced code blocks', () => {
    expect(makeSnippet('intro\n```js\nconst x = 1;\n```\noutro').includes('const x')).toBe(false);
  });

  it('truncates with an ellipsis', () => {
    const snippet = makeSnippet(`Title\n\n${'word '.repeat(100)}`, 20);
    expect(snippet.length).toBeLessThanOrEqual(21);
    expect(snippet.endsWith('…')).toBe(true);
  });
});
