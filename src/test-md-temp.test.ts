// @vitest-environment jsdom
import { test, expect } from 'vitest';
import { normalizeMarkdown } from './renderer/src/editor/markdown';

test('normalize heading+body', () => {
  const result1 = normalizeMarkdown('# Note to tidy\nteh cat');
  const result2 = normalizeMarkdown('# Note to tidy\n\nteh cat');
  const result3 = normalizeMarkdown('# Note to tidy \nteh cat');
  const result4 = normalizeMarkdown('# Note to tidy\n\nteh cat\n');
  
  console.log('Without blank line:', JSON.stringify(result1));
  console.log('With blank line:', JSON.stringify(result2));
  console.log('Trailing space:', JSON.stringify(result3));
  console.log('With trailing newline:', JSON.stringify(result4));
  
  expect(1).toBe(1);
});
