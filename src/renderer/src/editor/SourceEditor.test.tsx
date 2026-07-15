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

describe('SourceEditor', () => {
  it('renders one line number per line of content', () => {
    renderSource('alpha\nbravo\ncharlie');
    const gutter = screen.getByTestId('source-editor-gutter');
    expect(gutter.textContent).toBe('123');
  });

  it('renders a single line number for empty content', () => {
    renderSource('');
    const gutter = screen.getByTestId('source-editor-gutter');
    expect(gutter.textContent).toBe('1');
  });

  it('counts a trailing newline as an additional line', () => {
    renderSource('alpha\n');
    const gutter = screen.getByTestId('source-editor-gutter');
    expect(gutter.textContent).toBe('12');
  });
});
