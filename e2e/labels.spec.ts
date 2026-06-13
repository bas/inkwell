import { test, expect } from '@playwright/test';
import {
  launchApp,
  createNote,
  setTitle,
  waitSaved,
  readSingleNote,
  type LaunchedApp,
} from './helpers';

test.describe('Labels', () => {
  let ctx: LaunchedApp;

  test.beforeEach(async () => {
    ctx = await launchApp();
  });

  test.afterEach(async () => {
    await ctx?.close();
  });

  test('creates a label with a chosen color in the manager', async () => {
    const { page } = ctx;

    await page.getByTestId('manage-labels').click();
    await expect(page.getByTestId('new-label-name')).toBeVisible();

    await page.getByTestId('new-label-name').fill('work');
    await page.getByTestId('new-label-color').click();
    await page.getByTestId('color-opt-green').click();
    await page.getByTestId('create-label').click();

    await expect(page.getByTestId('label-row-work')).toBeVisible();
  });

  test('recolors an existing label', async () => {
    const { page } = ctx;

    await page.getByTestId('manage-labels').click();
    await page.getByTestId('new-label-name').fill('urgent');
    await page.getByTestId('create-label').click();
    await expect(page.getByTestId('label-row-urgent')).toBeVisible();

    await page.getByTestId('recolor-urgent').click();
    await page.getByTestId('color-opt-red').click();
    await expect(page.getByTestId('recolor-urgent')).toContainText('red');
  });

  test('creating a duplicate label name does not add a second row', async () => {
    const { page } = ctx;

    await page.getByTestId('manage-labels').click();
    await page.getByTestId('new-label-name').fill('dup');
    await page.getByTestId('create-label').click();
    await expect(page.getByTestId('label-row-dup')).toBeVisible();

    await page.getByTestId('new-label-name').fill('dup');
    await page.getByTestId('create-label').click();

    await expect(page.getByTestId('label-row-dup')).toHaveCount(1);
  });

  test('assigns a label to a note and persists it to frontmatter', async () => {
    const { page, vaultDir } = ctx;

    // Create a label.
    await page.getByTestId('manage-labels').click();
    await page.getByTestId('new-label-name').fill('work');
    await page.getByTestId('create-label').click();
    await expect(page.getByTestId('label-row-work')).toBeVisible();
    await page.keyboard.press('Escape');

    // Create a note and assign the label.
    await createNote(page);
    await setTitle(page, 'Labeled Note');
    await waitSaved(page);

    await page.getByTestId('label-picker').click();
    await page.getByTestId('label-option-work').click();
    await page.keyboard.press('Escape');

    await expect(page.getByTestId('label-chip-work').first()).toBeVisible();
    await expect.poll(() => readSingleNote(vaultDir)).toMatch(/labels:[\s\S]*work/);
  });

  test('creates and assigns a label inline from the picker', async () => {
    const { page, vaultDir } = ctx;

    await createNote(page);
    await setTitle(page, 'Inline Label Note');
    await waitSaved(page);

    await page.getByTestId('label-picker').click();
    await page.keyboard.type('inline');
    await page.getByTestId('create-label-inline').click();
    await page.keyboard.press('Escape');

    await expect(page.getByTestId('label-chip-inline').first()).toBeVisible();
    await expect.poll(() => readSingleNote(vaultDir)).toMatch(/labels:[\s\S]*inline/);
  });

  test('deleting a label removes it and strips it from notes', async () => {
    const { page, vaultDir } = ctx;

    // Create and assign a label.
    await page.getByTestId('manage-labels').click();
    await page.getByTestId('new-label-name').fill('temp');
    await page.getByTestId('create-label').click();
    await expect(page.getByTestId('label-row-temp')).toBeVisible();
    await page.keyboard.press('Escape');

    await createNote(page);
    await setTitle(page, 'Disposable Note');
    await waitSaved(page);
    await page.getByTestId('label-picker').click();
    await page.getByTestId('label-option-temp').click();
    await page.keyboard.press('Escape');
    await expect.poll(() => readSingleNote(vaultDir)).toMatch(/labels:[\s\S]*temp/);

    // Delete the label.
    await page.getByTestId('manage-labels').click();
    await page.getByTestId('delete-label-temp').click();
    await page.getByTestId('confirm-delete-temp').click();
    await expect(page.getByTestId('label-row-temp')).toHaveCount(0);
    await page.keyboard.press('Escape');

    // The label is stripped from the note's frontmatter.
    await expect(page.getByTestId('note-list').getByTestId('label-chip-temp')).toHaveCount(0);
    await expect.poll(() => readSingleNote(vaultDir)).not.toContain('temp');
  });
});
