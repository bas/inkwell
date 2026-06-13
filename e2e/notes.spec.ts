import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { launchApp, type LaunchedApp } from './helpers';

function readVaultMarkdown(vaultDir: string): string {
  const files = readdirSync(vaultDir).filter((name) => name.endsWith('.md'));
  expect(files.length).toBeGreaterThan(0);
  return files.map((name) => readFileSync(join(vaultDir, name), 'utf8')).join('\n');
}

test.describe('Inkwell notes', () => {
  let ctx: LaunchedApp;

  test.beforeEach(async () => {
    ctx = await launchApp();
  });

  test.afterEach(async () => {
    await ctx.close();
  });

  test('create, edit, search, pin a note and persist it as Markdown', async () => {
    const { page, vaultDir } = ctx;

    // Create a note.
    await page.getByTestId('new-note-button').click();
    const title = page.getByRole('textbox', { name: 'Note title' });
    await expect(title).toHaveValue('Untitled');

    // Edit the title and body.
    await title.fill('My E2E Note');
    const body = page.getByTestId('editor-content');
    await body.click();
    await page.keyboard.type('Hello from Playwright');

    // Autosave should land and the file should appear on disk.
    await expect(page.getByTestId('save-state')).toHaveText('Saved', { timeout: 15_000 });
    await expect.poll(() => readVaultMarkdown(vaultDir)).toContain('title: My E2E Note');
    expect(readVaultMarkdown(vaultDir)).toContain('Hello from Playwright');

    // Search finds the note by title.
    await page.getByTestId('search-input').fill('E2E');
    await expect(page.getByTestId('note-list')).toContainText('My E2E Note');

    // Clear the search, then pin the note via the actions menu.
    await page.getByTestId('search-input').fill('');
    await page.getByTestId('note-actions').click();
    await page.getByTestId('action-toggle-pin').click();
    await expect(page.getByTestId('note-list')).toContainText('Pinned');

    // The pin flag is persisted to the Markdown frontmatter.
    await expect.poll(() => readVaultMarkdown(vaultDir)).toContain('pinned: true');
  });

  test('toggles the color mode to dark', async () => {
    const { page } = ctx;
    await page.getByRole('button', { name: 'Dark' }).click();
    await expect(page.locator('[data-color-mode="dark"]')).toHaveCount(1);
  });
});
