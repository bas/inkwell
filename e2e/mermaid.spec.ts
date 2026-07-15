import { test, expect } from '@playwright/test';
import { createNote, launchApp, readSingleNote, switchView, type LaunchedApp } from './helpers';

test.describe('Mermaid diagrams', () => {
  let ctx: LaunchedApp;

  test.beforeEach(async () => {
    ctx = await launchApp();
  });

  test.afterEach(async () => {
    await ctx?.close();
  });

  test('adds a diagram from the WYSIWYG toolbar and saves fenced Markdown', async () => {
    const { page, vaultDir } = ctx;

    await createNote(page);
    await page.getByTestId('fmt-mermaid').click();
    await page
      .getByRole('textbox', { name: 'Mermaid diagram source' })
      .fill('flowchart LR\n  A[Start] --> B[End]');
    await page.getByTestId('mermaid-done').click();

    await expect(page.getByTestId('mermaid-preview')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Collapse diagram' }).click();
    await expect(page.getByTestId('mermaid-collapsed')).toBeVisible();
    await expect(page.getByTestId('mermaid-preview')).toHaveCount(0);
    await page.getByRole('button', { name: 'Expand diagram' }).click();
    await expect(page.getByTestId('mermaid-preview')).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(() => readSingleNote(vaultDir))
      .toContain('```mermaid\nflowchart LR\n  A[Start] --> B[End]\n```');
  });

  test('renders fenced Mermaid Markdown entered in Source mode', async () => {
    const { page, vaultDir } = ctx;

    await createNote(page);
    await switchView(page, 'source');
    await page
      .getByTestId('source-editor')
      .fill('# Source diagram\n\n```mermaid\nflowchart TD\n  Source --> Preview\n```');
    await switchView(page, 'wysiwyg');

    await expect(page.getByTestId('mermaid-preview')).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(() => readSingleNote(vaultDir))
      .toContain('```mermaid\nflowchart TD\n  Source --> Preview\n```');
  });
});
