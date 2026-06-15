import { test, expect } from '@playwright/test';
import {
  launchApp,
  createNote,
  setTitle,
  typeBody,
  waitSaved,
  openSummary,
  readSingleNote,
  type LaunchedApp,
} from './helpers';

const FAKE_SUMMARY = 'This is a deterministic test summary of the note.';

test.describe('AI summarize', () => {
  let ctx: LaunchedApp;

  test.beforeEach(async () => {
    // INKWELL_FAKE_AI stubs the Copilot runtime so the flow is deterministic
    // and offline; the stub streams this value back as the generated summary.
    ctx = await launchApp({ env: { INKWELL_FAKE_AI: FAKE_SUMMARY } });
  });

  test.afterEach(async () => {
    await ctx?.close();
  });

  test('summarizes a note and shows the result in the panel', async () => {
    const { page } = ctx;

    await createNote(page);
    await setTitle(page, 'Note to summarize');
    await typeBody(page, 'Some note content worth summarizing.');
    await waitSaved(page);

    await openSummary(page);

    await expect(page.getByTestId('ai-summary-text')).toContainText(FAKE_SUMMARY);
    await expect(page.getByTestId('ai-usage-panel')).toBeVisible();
    await expect(page.getByTestId('ai-usage-panel')).toContainText('Usage for this request');
    await expect(page.getByTestId('ai-summary-insert')).toBeEnabled();
  });

  test('inserts the summary as a TL;DR block and writes it to disk', async () => {
    const { page, vaultDir } = ctx;

    await createNote(page);
    await setTitle(page, 'Note with TLDR');
    await typeBody(page, 'Original body text.');
    await waitSaved(page);

    await openSummary(page);
    await expect(page.getByTestId('ai-summary-text')).toContainText(FAKE_SUMMARY);
    await page.getByTestId('ai-summary-insert').click();

    // Panel closes after a successful insert.
    await expect(page.getByTestId('ai-summary-dialog')).toBeHidden();
    await waitSaved(page);

    await expect.poll(() => readSingleNote(vaultDir)).toContain('**TL;DR**');
    const note = readSingleNote(vaultDir);
    expect(note).not.toContain('<!--');
    expect(note).toContain(FAKE_SUMMARY);
    expect(note).toContain('Original body text.');
  });
});
