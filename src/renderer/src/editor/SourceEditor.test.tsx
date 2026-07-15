// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@primer/react';
import { SourceEditor } from './SourceEditor';

afterEach(cleanup);

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    value: () => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
    configurable: true,
  });
});

function renderSource(value: string): void {
  render(
    <ThemeProvider>
      <SourceEditor value={value} onChange={() => {}} />
    </ThemeProvider>,
  );
}

function gutterRows(): HTMLElement[] {
  const gutter = screen.getByTestId('source-editor-gutter');
  return Array.from(gutter.querySelectorAll('div'));
}

describe('SourceEditor', () => {
  it('renders one line number per line of content', () => {
    renderSource('alpha\nbravo\ncharlie');
    const rows = gutterRows();
    expect(rows).toHaveLength(3);
    expect(rows[0]?.textContent).toBe('1');
    expect(rows[rows.length - 1]?.textContent).toBe('3');
  });

  it('renders a single line number for empty content', () => {
    renderSource('');
    const rows = gutterRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toBe('1');
  });

  it('counts a trailing newline as an additional line', () => {
    renderSource('alpha\n');
    const rows = gutterRows();
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toBe('1');
    expect(rows[1]?.textContent).toBe('2');
  });
});
