// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MarkdownEditor } from './MarkdownEditor';

afterEach(cleanup);

describe('MarkdownEditor', () => {
  it('applies the shared markdown alignment class', async () => {
    render(<MarkdownEditor initialMarkdown="" onChange={vi.fn()} />);
    const content = await screen.findByTestId('editor-content');
    expect(content.className).toContain('markdown-body');
    expect(content.className).toContain('ink-markdown-aligned');
  });
});
