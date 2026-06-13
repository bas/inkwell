import { test, expect } from '@playwright/test';
import {
  launchApp,
  createNote,
  setTitle,
  typeBody,
  waitSaved,
  readVaultMarkdown,
  readSingleNote,
  countVaultNotes,
  readClipboard,
  type LaunchedApp,
} from './helpers';

test.describe('Notes CRUD', () => {
  let ctx: LaunchedApp;

  test.beforeEach(async () => {
    ctx = await launchApp();
  });

  test.afterEach(async () => {
    await ctx?.close();
  });

  test('creates a note with the default title and writes it to disk', async () => {
    const { page, vaultDir } = ctx;

    await createNote(page);
    await expect(page.getByTestId('editor-title')).toHaveValue('Untitled');
    await expect(page.getByTestId('note-list')).toContainText('Untitled');

    await expect.poll(() => countVaultNotes(vaultDir)).toBe(1);
  });

  test('edits the title and body and persists them as Markdown', async () => {
    const { page, vaultDir } = ctx;

    await createNote(page);
    await setTitle(page, 'My E2E Note');
    await typeBody(page, 'Hello from Playwright');
    await waitSaved(page);

    await expect.poll(() => readSingleNote(vaultDir)).toContain('title: My E2E Note');
    expect(readSingleNote(vaultDir)).toContain('Hello from Playwright');
  });

  test('creates multiple notes and keeps them all on disk', async () => {
    const { page, vaultDir } = ctx;

    await createNote(page);
    await setTitle(page, 'First Note');
    await typeBody(page, 'first body');
    await waitSaved(page);

    await createNote(page);
    await setTitle(page, 'Second Note');
    await typeBody(page, 'second body');
    await waitSaved(page);

    await expect.poll(() => countVaultNotes(vaultDir)).toBe(2);
    await expect(page.getByTestId('note-list')).toContainText('First Note');
    await expect(page.getByTestId('note-list')).toContainText('Second Note');
  });

  test('pins and unpins a note, reflecting the state in the list and on disk', async () => {
    const { page, vaultDir } = ctx;

    await createNote(page);
    await setTitle(page, 'Pinnable');
    await waitSaved(page);

    // Pin.
    await page.getByTestId('note-actions').click();
    await page.getByTestId('action-toggle-pin').click();
    await expect(page.getByTestId('note-list')).toContainText('Pinned');
    await expect.poll(() => readVaultMarkdown(vaultDir)).toContain('pinned: true');

    // Unpin.
    await page.getByTestId('note-actions').click();
    await page.getByTestId('action-toggle-pin').click();
    await expect(page.getByTestId('note-list')).not.toContainText('Pinned');
    await expect.poll(() => readVaultMarkdown(vaultDir)).toContain('pinned: false');
  });

  test('copies the note as Markdown to the clipboard', async () => {
    const { app, page } = ctx;

    await createNote(page);
    await setTitle(page, 'Copy Me');
    await typeBody(page, 'clipboard body');
    await waitSaved(page);

    await page.getByTestId('note-actions').click();
    await page.getByTestId('action-copy-markdown').click();

    await expect(page.getByTestId('save-state')).toHaveText('Copied to clipboard');
    const clip = await readClipboard(app);
    expect(clip).toContain('# Copy Me');
    expect(clip).toContain('clipboard body');
  });

  test('deletes a note and removes it from the list and disk', async () => {
    const { page, vaultDir } = ctx;

    await createNote(page);
    await setTitle(page, 'Doomed Note');
    await waitSaved(page);
    await expect.poll(() => countVaultNotes(vaultDir)).toBe(1);

    await page.getByTestId('note-actions').click();
    await page.getByTestId('action-delete').click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(page.getByTestId('editor-empty')).toBeVisible();
    await expect(page.getByText('No notes yet')).toBeVisible();
    await expect.poll(() => countVaultNotes(vaultDir)).toBe(0);
  });
});
