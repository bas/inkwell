// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MarkdownEditor } from './MarkdownEditor';

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    parse: vi.fn(async () => ({ diagramType: 'flowchart-v2' })),
    render: vi.fn(async () => ({ svg: '<svg data-testid="rendered-mermaid"></svg>' })),
  },
}));

afterEach(cleanup);

describe('MarkdownEditor', () => {
  it('applies the shared markdown alignment class', async () => {
    render(<MarkdownEditor initialMarkdown="" onChange={vi.fn()} />);
    const content = await screen.findByTestId('editor-content');
    expect(content.className).toContain('markdown-body');
    expect(content.className).toContain('ink-markdown-aligned');
  });

  it('defaults an empty note to an h1 first line', async () => {
    render(<MarkdownEditor initialMarkdown="" onChange={vi.fn()} />);
    const content = await screen.findByTestId('editor-content');
    expect(content.firstElementChild?.tagName).toBe('H1');
  });

  it('renders mermaid fenced code blocks as diagram blocks', async () => {
    render(
      <MarkdownEditor
        initialMarkdown={['```mermaid', 'flowchart LR', '  A --> B', '```'].join('\n')}
        onChange={vi.fn()}
      />,
    );

    expect(await screen.findByTestId('mermaid-block')).toBeTruthy();
    expect(await screen.findByTestId('mermaid-preview')).toBeTruthy();
  });
});
