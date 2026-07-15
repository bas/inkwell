import { test, expect, type Page } from '@playwright/test';
import {
  launchApp,
  createNote,
  setTitle,
  waitSaved,
  readSingleNote,
  openSettings,
  type LaunchedApp,
} from './helpers';

function labelRow(page: Page, name: string) {
  return page.getByTestId(/^label-row-/).filter({ hasText: name });
}

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

    await openSettings(page);
    await expect(page.getByTestId('new-label-name')).toBeVisible();

    await page.getByTestId('new-label-name').fill('work');
    await page.getByTestId('new-label-color').click();
    await page.getByTestId('color-opt-green').click();
    await page.getByTestId('create-label').click();

    await expect(labelRow(page, 'work')).toBeVisible();
  });

  test('recolors an existing label', async () => {
    const { page } = ctx;

    await openSettings(page);
    await page.getByTestId('new-label-name').fill('urgent');
    await page.getByTestId('create-label').click();
    const row = labelRow(page, 'urgent');
    await expect(row).toBeVisible();

    await row.getByTestId(/^recolor-/).click();
    await page.getByTestId('color-opt-red').click();
    await expect(row.getByTestId(/^recolor-/)).toContainText('red');
  });

  test('creating a duplicate label name does not add a second row', async () => {
    const { page } = ctx;

    await openSettings(page);
    await page.getByTestId('new-label-name').fill('dup');
    await page.getByTestId('create-label').click();
    await expect(labelRow(page, 'dup')).toBeVisible();

    await page.getByTestId('new-label-name').fill('dup');
    await page.getByTestId('create-label').click();

    await expect(labelRow(page, 'dup')).toHaveCount(1);
  });

  test('assigns a label to a note and persists it to frontmatter', async () => {
    const { page, vaultDir } = ctx;

    // Create a label.
    await openSettings(page);
    await page.getByTestId('new-label-name').fill('work');
    await page.getByTestId('create-label').click();
    await expect(labelRow(page, 'work')).toBeVisible();
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
    await openSettings(page);
    await page.getByTestId('new-label-name').fill('temp');
    await page.getByTestId('create-label').click();
    await expect(labelRow(page, 'temp')).toBeVisible();
    await page.keyboard.press('Escape');

    await createNote(page);
    await setTitle(page, 'Disposable Note');
    await waitSaved(page);
    await page.getByTestId('label-picker').click();
    await page.getByTestId('label-option-temp').click();
    await page.keyboard.press('Escape');
    await expect.poll(() => readSingleNote(vaultDir)).toMatch(/labels:[\s\S]*temp/);

    // Delete the label.
    await openSettings(page);
    const row = labelRow(page, 'temp');
    await row.getByTestId(/^delete-label-/).click();
    await row.getByTestId(/^confirm-delete-/).click();
    await expect(labelRow(page, 'temp')).toHaveCount(0);
    await page.keyboard.press('Escape');

    // The label is stripped from the note's frontmatter.
    await expect(page.getByTestId('note-list').getByTestId('label-chip-temp')).toHaveCount(0);
    await expect.poll(() => readSingleNote(vaultDir)).not.toContain('temp');
  });

  test('disabling labels hides label UI without removing frontmatter labels', async () => {
    const { page, vaultDir } = ctx;

    await openSettings(page);
    await page.getByTestId('new-label-name').fill('kept');
    await page.getByTestId('create-label').click();
    await expect(labelRow(page, 'kept')).toBeVisible();
    await page.keyboard.press('Escape');

    await createNote(page);
    await setTitle(page, 'Preserved Label Note');
    await waitSaved(page);
    await page.getByTestId('label-picker').click();
    await page.getByTestId('label-option-kept').click();
    await page.keyboard.press('Escape');
    await expect.poll(() => readSingleNote(vaultDir)).toMatch(/labels:[\s\S]*kept/);

    await openSettings(page);
    await page.getByTestId('feature-labels-toggle').click();
    await expect(page.getByTestId('labels-disabled-message')).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(page.getByTestId('label-picker')).toHaveCount(0);
    await expect(page.getByTestId('group-by-label')).toHaveCount(0);
    await expect(page.getByTestId('label-chip-kept')).toHaveCount(0);
    await expect.poll(() => readSingleNote(vaultDir)).toMatch(/labels:[\s\S]*kept/);

    await openSettings(page);
    await page.getByTestId('feature-labels-toggle').click();
    await page.keyboard.press('Escape');

    await expect(page.getByTestId('label-picker')).toBeVisible();
    await expect(page.getByTestId('label-chip-kept').first()).toBeVisible();
  });
});
