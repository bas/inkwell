import { test, expect } from '@playwright/test';
import { launchApp, type LaunchedApp, createNote } from './helpers';

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
});
