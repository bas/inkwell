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

function gutterLines(): string[] {
  const gutter = screen.getByTestId('source-editor-gutter');
  return (gutter.textContent ?? '').split('\n');
}

describe('SourceEditor', () => {
  it('renders one line number per line of content', () => {
    renderSource('alpha\nbravo\ncharlie');
    const lines = gutterLines();
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('1');
    expect(lines[lines.length - 1]).toBe('3');
  });

  it('renders a single line number for empty content', () => {
    renderSource('');
    const lines = gutterLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('1');
  });

  it('counts a trailing newline as an additional line', () => {
    renderSource('alpha\n');
    const lines = gutterLines();
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('1');
    expect(lines[1]).toBe('2');
  });
});
