import { test, expect, type Page } from '@playwright/test';
import {
  launchApp,
  createNote,
  setTitle,
  typeBody,
  waitSaved,
  expectNoteListTitle,
  type LaunchedApp,
} from './helpers';

/** Create a label through the manager dialog. */
async function createLabel(page: Page, name: string): Promise<void> {
  await page.getByTestId('manage-labels').click();
  await page.getByTestId('new-label-name').fill(name);
  await page.getByTestId('create-label').click();
  await expect(page.getByTestId(`label-row-${name}`)).toBeVisible();
  await page.keyboard.press('Escape');
}

/** Assign an existing label to the currently open note. */
async function assignLabel(page: Page, name: string): Promise<void> {
  await page.getByTestId('label-picker').click();
  await page.getByTestId(`label-option-${name}`).click();
  await page.keyboard.press('Escape');
}

test.describe('Search and filter', () => {
  let ctx: LaunchedApp;

  test.beforeEach(async () => {
    ctx = await launchApp();
  });

  test.afterEach(async () => {
    await ctx?.close();
  });

  test('searches notes by body text', async () => {
    const { page } = ctx;

    await createNote(page);
    await setTitle(page, 'Alpha');
    await typeBody(page, 'apple content');
    await waitSaved(page);

    await createNote(page);
    await setTitle(page, 'Beta');
    await typeBody(page, 'banana content');
    await waitSaved(page);

    await page.getByTestId('search-input').fill('apple');
    await expectNoteListTitle(page, 'Alpha', true);
    await expectNoteListTitle(page, 'Beta', false);

    // Clearing the search restores the full list.
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expectNoteListTitle(page, 'Alpha', true);
    await expectNoteListTitle(page, 'Beta', true);
  });

  test('searches notes by title', async () => {
    const { page } = ctx;

    await createNote(page);
    await setTitle(page, 'Groceries');
    await waitSaved(page);

    await createNote(page);
    await setTitle(page, 'Meeting');
    await waitSaved(page);

    await page.getByTestId('search-input').fill('Grocer');
    await expectNoteListTitle(page, 'Groceries', true);
    await expectNoteListTitle(page, 'Meeting', false);
  });

  test('shows an empty list when nothing matches', async () => {
    const { page } = ctx;

    await createNote(page);
    await setTitle(page, 'Only Note');
    await waitSaved(page);

    await page.getByTestId('search-input').fill('zzzzznomatch');
    await expect(page.getByText('No matching notes')).toBeVisible();
  });

  test('groups notes by label when the Labels view is selected', async () => {
    const { page } = ctx;

    await createLabel(page, 'work');

    await createNote(page);
    await setTitle(page, 'Work Note');
    await waitSaved(page);
    await assignLabel(page, 'work');

    await createNote(page);
    await setTitle(page, 'Personal Note');
    await waitSaved(page);

    // Switch the sidebar to group by label.
    await page.getByTestId('group-by-label').click();

    // The label heading and its note are shown, and the unlabelled note falls
    // under the "No label" section.
    await expect(
      page.getByTestId('note-list').getByRole('heading', { name: 'work' }),
    ).toBeVisible();
    await expect(
      page.getByTestId('note-list').getByRole('heading', { name: 'No label' }),
    ).toBeVisible();
    await expectNoteListTitle(page, 'Work Note', true);
    await expectNoteListTitle(page, 'Personal Note', true);
  });

  test('search works regardless of the active grouping', async () => {
    const { page } = ctx;

    await createLabel(page, 'work');

    await createNote(page);
    await setTitle(page, 'Work Note');
    await typeBody(page, 'quarterly report');
    await waitSaved(page);
    await assignLabel(page, 'work');

    await createNote(page);
    await setTitle(page, 'Personal Note');
    await typeBody(page, 'grocery list');
    await waitSaved(page);

    // Group by label, then search: matches surface as a flat list.
    await page.getByTestId('group-by-label').click();
    await page.getByTestId('search-input').fill('grocery');
    await expectNoteListTitle(page, 'Personal Note', true);
    await expectNoteListTitle(page, 'Work Note', false);
  });
});
