import { test, expect } from '@playwright/test';
import {
  launchApp,
  createNote,
  setTitle,
  typeBody,
  waitSaved,
  openReview,
  readSingleNote,
  type LaunchedApp,
} from './helpers';

// The fake AI streams this exact value back as the model response, so it must
// be valid review JSON matching the structured suggestion schema.
const FAKE_REVIEW = JSON.stringify({
  summary: 'One clarity improvement found.',
  suggestions: [
    {
      id: 's1',
      title: 'Improve clarity',
      category: 'clarity',
      severity: 'low',
      rationale: 'Clearer wording reads better.',
      confidence: 0.9,
      replacement: 'Improved body text.',
      target: {
        startLine: 1,
        endLine: 1,
        before: 'Original body text.',
        anchorText: 'Original body text.',
      },
    },
  ],
});

test.describe('AI review', () => {
  let ctx: LaunchedApp;

  test.beforeEach(async () => {
    ctx = await launchApp({ env: { INKWELL_FAKE_AI: FAKE_REVIEW } });
  });

  test.afterEach(async () => {
    await ctx?.close();
  });

  test('shows structured suggestions in the review panel', async () => {
    const { page } = ctx;

    await createNote(page);
    await setTitle(page, 'Note to review');
    await typeBody(page, 'Original body text.');
    await waitSaved(page);

    await openReview(page);

    await expect(page.getByTestId('review-summary')).toContainText(
      'One clarity improvement found.',
    );
    await expect(page.getByTestId('review-item-s1')).toBeVisible();
    await expect(page.getByTestId('review-diff')).toContainText('Improved body text.');
  });

  test('applies a suggestion and writes the change to disk', async () => {
    const { page, vaultDir } = ctx;

    await createNote(page);
    await setTitle(page, 'Note to apply');
    await typeBody(page, 'Original body text.');
    await waitSaved(page);

    await openReview(page);
    await expect(page.getByTestId('review-item-s1')).toBeVisible();

    await page.getByTestId('review-apply').click();

    await expect(page.getByTestId('review-status-s1')).toHaveText('Applied');

    await expect.poll(() => readSingleNote(vaultDir)).toContain('Improved body text.');
    const note = readSingleNote(vaultDir);
    expect(note).not.toContain('Original body text.');
  });

  test('rejecting a suggestion leaves the note unchanged', async () => {
    const { page, vaultDir } = ctx;

    await createNote(page);
    await setTitle(page, 'Note to reject');
    await typeBody(page, 'Original body text.');
    await waitSaved(page);

    await openReview(page);
    await expect(page.getByTestId('review-item-s1')).toBeVisible();

    await page.getByTestId('review-reject').click();
    await expect(page.getByTestId('review-status-s1')).toHaveText('Rejected');

    const note = readSingleNote(vaultDir);
    expect(note).toContain('Original body text.');
    expect(note).not.toContain('Improved body text.');
  });
});
