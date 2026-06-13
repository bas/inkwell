import { describe, it, expect } from 'vitest';
import { makeSnippet } from './snippet';

describe('makeSnippet', () => {
  it('strips heading markers and formatting', () => {
    expect(makeSnippet('# Title\n\nSome **bold** and _italic_ text.')).toBe(
      'Title Some bold and italic text.',
    );
  });

  it('converts links to their text', () => {
    expect(makeSnippet('See [Primer](https://primer.style) docs')).toBe('See Primer docs');
  });

  it('removes fenced code blocks', () => {
    expect(makeSnippet('intro\n```js\nconst x = 1;\n```\noutro').includes('const x')).toBe(false);
  });

  it('truncates with an ellipsis', () => {
    const snippet = makeSnippet('word '.repeat(100), 20);
    expect(snippet.length).toBeLessThanOrEqual(21);
    expect(snippet.endsWith('…')).toBe(true);
  });
});
