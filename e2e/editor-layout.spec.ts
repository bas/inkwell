import { test, expect } from '@playwright/test';
import {
  launchApp,
  type LaunchedApp,
  createNote,
  setTitle,
  switchView,
  waitSaved,
} from './helpers';

test.describe('Editor layout', () => {
  let ctx: LaunchedApp;

  test.beforeEach(async () => {
    ctx = await launchApp();
  });

  test.afterEach(async () => {
    await ctx?.close();
  });

  test('keeps the toolbar visible when the note overflows the viewport', async () => {
    const { page } = ctx;
    await createNote(page);

    // Fill the editor with enough content to exceed the available height.
    await page.getByTestId('editor-content').click();
    for (let i = 0; i < 80; i++) {
      await page.keyboard.type(`Line ${i} of a long note used to force vertical overflow.`);
      await page.keyboard.press('Enter');
    }

    // The toolbar must stay pinned in view rather than scrolling off-screen.
    await expect(page.getByTestId('editor-toolbar')).toBeInViewport();
    await expect(page.getByTestId('view-wysiwyg')).toBeInViewport();

    // The card itself must stay within the viewport; the body scrolls internally.
    const cardBox = await page.getByTestId('editor-card').boundingBox();
    const windowHeight = await page.evaluate(
      () => (globalThis as unknown as { innerHeight: number }).innerHeight,
    );
    expect(cardBox).not.toBeNull();
    expect(cardBox!.y).toBeGreaterThanOrEqual(0);
    expect(cardBox!.height).toBeLessThanOrEqual(windowHeight);
  });

  test('reopens a long note and can scroll between the top and bottom in both editor views', async () => {
    const first = ctx;
    const { page } = first;

    await createNote(page);
    await setTitle(page, 'Long scrolling note');

    await page.getByTestId('editor-content').click();
    for (let i = 0; i < 160; i++) {
      await page.keyboard.type(`Paragraph ${i} of a note that must stay scrollable after reopen.`);
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
    }
    await waitSaved(page);
    await first.close({ keepDirs: true });

    ctx = await launchApp({
      reuse: { vaultDir: first.vaultDir, userDataDir: first.userDataDir },
    });
    await ctx.page.getByText('Long scrolling note', { exact: true }).click();

    await expect(ctx.page.getByTestId('editor-title')).toBeVisible();
    await expect(ctx.page.getByTestId('editor-toolbar')).toBeInViewport();

    const wysiwygScroll = await ctx.page.getByTestId('editor-content').evaluate((element) => {
      const scroller = element.closest('.ink-editor');
      if (
        !scroller ||
        typeof (scroller as { scrollHeight?: unknown }).scrollHeight !== 'number' ||
        typeof (scroller as { clientHeight?: unknown }).clientHeight !== 'number' ||
        typeof (scroller as { scrollTop?: unknown }).scrollTop !== 'number'
      ) {
        throw new Error('Expected a scrollable WYSIWYG container');
      }
      const scrollable = scroller as {
        scrollHeight: number;
        clientHeight: number;
        scrollTop: number;
      };
      const max = scrollable.scrollHeight - scrollable.clientHeight;
      scrollable.scrollTop = max;
      const bottom = scrollable.scrollTop;
      scrollable.scrollTop = 0;
      return { max, bottom, top: scroller.scrollTop };
    });

    expect(wysiwygScroll.max).toBeGreaterThan(0);
    expect(wysiwygScroll.bottom).toBeGreaterThan(0);
    expect(wysiwygScroll.top).toBe(0);

    await switchView(ctx.page, 'source');
    const source = ctx.page.getByTestId('source-editor');
    await expect(source).toBeVisible();
    const sourceScroll = await source.evaluate((element) => {
      if (
        typeof (element as { scrollHeight?: unknown }).scrollHeight !== 'number' ||
        typeof (element as { clientHeight?: unknown }).clientHeight !== 'number' ||
        typeof (element as { scrollTop?: unknown }).scrollTop !== 'number'
      ) {
        throw new Error('Expected the Markdown source textarea');
      }
      const textarea = element as {
        scrollHeight: number;
        clientHeight: number;
        scrollTop: number;
      };
      const max = textarea.scrollHeight - textarea.clientHeight;
      textarea.scrollTop = max;
      const bottom = textarea.scrollTop;
      textarea.scrollTop = 0;
      return { max, bottom, top: textarea.scrollTop };
    });

    expect(sourceScroll.max).toBeGreaterThan(0);
    expect(sourceScroll.bottom).toBeGreaterThan(0);
    expect(sourceScroll.top).toBe(0);
  });
});
