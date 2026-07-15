import { test, expect } from '@playwright/test';
import {
  launchApp,
  createNote,
  setTitle,
  typeBody,
  waitSaved,
  openTidy,
  readSingleNote,
  type LaunchedApp,
} from './helpers';

// The fake AI streams these exact values back as the model response, so each
// must be valid tidy JSON matching the structured suggestion schema.

// One low-risk spelling fix that the flow applies automatically.
const FAKE_AUTO = JSON.stringify({
  summary: 'Fixed one spelling slip.',
  suggestions: [
    {
      id: 's1',
      title: 'Fix spelling',
      category: 'spelling',
      severity: 'low',
      rationale: 'Corrects a misspelling.',
      confidence: 0.95,
      autoApplyable: true,
      replacement: 'the cat',
      target: { startLine: 1, endLine: 1, before: 'teh cat', anchorText: 'teh cat' },
    },
  ],
});

// One formatting suggestion that must be reviewed and applied by hand.
const FAKE_REVIEW = JSON.stringify({
  summary: 'Suggested a heading.',
  suggestions: [
    {
      id: 'f1',
      title: 'Add a heading',
      category: 'formatting',
      severity: 'low',
      rationale: 'A heading makes the note easier to scan.',
      confidence: 0.7,
      autoApplyable: false,
      replacement: '## Plain text',
      target: { startLine: 1, endLine: 1, before: 'plain text', anchorText: 'plain text' },
    },
  ],
});

test.describe('AI tidy', () => {
  let ctx: LaunchedApp;

  test.afterEach(async () => {
    await ctx?.close();
  });

  test('auto-applies a low-risk fix and offers undo', async () => {
    ctx = await launchApp({ env: { INKWELL_FAKE_AI: FAKE_AUTO } });
    const { page, vaultDir } = ctx;

    await createNote(page);
    await setTitle(page, 'Note to tidy');
    await typeBody(page, 'teh cat');
    await waitSaved(page);

    await openTidy(page);

    // The auto-applied banner confirms the silent fix landed.
    await expect(page.getByTestId('fix-auto-applied')).toContainText('Applied 1');
    await expect(page.getByTestId('editor-card')).toBeVisible();

    // The corrected text is written to disk.
    expect(readSingleNote(vaultDir)).toContain('the cat');

    // Undo restores the pre-tidy body and closes the panel.
    await page.getByTestId('fix-undo').click();
    await expect(page.getByTestId('ai-fix-dialog')).toBeHidden();
    expect(readSingleNote(vaultDir)).toContain('teh cat');
  });

  test('applies a reviewed suggestion and writes the change to disk', async () => {
    ctx = await launchApp({ env: { INKWELL_FAKE_AI: FAKE_REVIEW } });
    const { page, vaultDir } = ctx;

    await createNote(page);
    await setTitle(page, 'Note to format');
    await typeBody(page, 'plain text');
    await waitSaved(page);

    await openTidy(page);

    const item = page.getByTestId('fix-item-f1');
    await expect(item).toBeVisible();
    await item.click();
    await page.getByTestId('fix-apply').click();

    await expect(page.getByTestId('fix-status-f1')).toContainText('Applied');
    expect(readSingleNote(vaultDir)).toContain('## Plain text');
  });
});
