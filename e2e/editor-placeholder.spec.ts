import { test, expect } from '@playwright/test';
import { launchApp, createNote, type LaunchedApp } from './helpers';

test.describe('Editor placeholder', () => {
  let ctx: LaunchedApp;

  test.beforeEach(async () => {
    ctx = await launchApp();
  });

  test.afterEach(async () => {
    await ctx?.close();
  });

  test('shows the "Start writing…" placeholder on the empty first (heading) line', async () => {
    const { page } = ctx;

    await createNote(page);

    // New notes open with the first node as an H1, and it must carry the
    // empty-editor placeholder marker so the ::before hint renders.
    const firstLine = page.locator('[data-testid="editor-content"] .is-editor-empty:first-child');
    await expect(firstLine).toHaveAttribute('data-placeholder', 'Start writing…');

    // The placeholder text is painted via a ::before pseudo-element on that node.
    const placeholderText = await firstLine.evaluate((el) => {
      const getStyle = (
        globalThis as unknown as {
          getComputedStyle: (e: unknown, pseudo: string) => { content: string };
        }
      ).getComputedStyle;
      return getStyle(el, '::before').content;
    });
    expect(placeholderText).toContain('Start writing');
  });
});
