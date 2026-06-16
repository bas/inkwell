import { test, expect } from '@playwright/test';
import {
  launchApp,
  createNote,
  typeBody,
  waitSaved,
  switchView,
  readSingleNote,
  type LaunchedApp,
} from './helpers';

test.describe('Find and replace', () => {
  let ctx: LaunchedApp;

  test.beforeEach(async () => {
    ctx = await launchApp();
    await createNote(ctx.page);
  });

  test.afterEach(async () => {
    await ctx?.close();
  });

  test('opens with keyboard shortcut', async () => {
    const { page } = ctx;
    await page.getByTestId('editor-content').click();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+f' : 'Control+f');
    await expect(page.getByTestId('find-replace-bar')).toBeVisible();
    await expect(page.getByTestId('find-input')).toBeFocused();
  });

  test('replaces all exact matches in source mode', async () => {
    const { page, vaultDir } = ctx;

    await switchView(page, 'source');
    await page.getByTestId('source-editor').fill('apple banana apple');
    await waitSaved(page);

    await page.getByTestId('open-find-replace').click();
    await page.getByTestId('find-input').fill('apple');
    await page.getByTestId('replace-input').fill('pear');
    await page.getByTestId('replace-all').click();
    await waitSaved(page);

    expect(readSingleNote(vaultDir)).toContain('pear banana pear');
  });

  test('replaces one exact match in editor mode', async () => {
    const { page, vaultDir } = ctx;

    await typeBody(page, 'apple banana apple');
    await waitSaved(page);

    await page.getByTestId('open-find-replace').click();
    await page.getByTestId('find-input').fill('apple');
    await page.getByTestId('replace-input').fill('pear');
    await page.getByTestId('find-input').press('Enter');
    await page.getByTestId('replace-one').click();
    await waitSaved(page);

    const markdown = readSingleNote(vaultDir);
    expect(markdown).toContain('pear banana apple');
    expect(markdown).not.toContain('apple banana apple');
  });
});
