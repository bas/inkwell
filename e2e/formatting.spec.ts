import { test, expect, type Page } from '@playwright/test';
import {
  launchApp,
  createNote,
  typeBody,
  waitSaved,
  switchView,
  readSingleNote,
  type LaunchedApp,
} from './helpers';

/** Select all text in the focused WYSIWYG editor. */
async function selectAll(page: Page): Promise<void> {
  await page.getByTestId('editor-content').click();
  await page.keyboard.press('Meta+a');
}

test.describe('Editor formatting', () => {
  let ctx: LaunchedApp;

  test.beforeEach(async () => {
    ctx = await launchApp();
    await createNote(ctx.page);
  });

  test.afterEach(async () => {
    await ctx?.close();
  });

  test('applies headings via the heading menu', async () => {
    const { page, vaultDir } = ctx;
    await typeBody(page, 'Heading text');

    await page.getByTestId('heading-menu').click();
    await page.getByTestId('heading-opt-1').click();
    await waitSaved(page);
    expect(readSingleNote(vaultDir)).toContain('# Heading text');

    await page.getByTestId('heading-menu').click();
    await page.getByTestId('heading-opt-2').click();
    await waitSaved(page);
    expect(readSingleNote(vaultDir)).toContain('## Heading text');

    await page.getByTestId('heading-menu').click();
    await page.getByTestId('heading-opt-3').click();
    await waitSaved(page);
    expect(readSingleNote(vaultDir)).toContain('### Heading text');
  });

  test('applies bold and reflects the active state', async () => {
    const { page, vaultDir } = ctx;
    await typeBody(page, 'bold me');
    await selectAll(page);
    await page.getByTestId('fmt-bold').click();
    await waitSaved(page);

    expect(readSingleNote(vaultDir)).toContain('**bold me**');
    await expect(page.getByTestId('fmt-bold')).toHaveAttribute('aria-pressed', 'true');
  });

  test('applies italic', async () => {
    const { page, vaultDir } = ctx;
    await typeBody(page, 'italic me');
    await selectAll(page);
    await page.getByTestId('fmt-italic').click();
    await waitSaved(page);

    expect(readSingleNote(vaultDir)).toContain('*italic me*');
  });

  test('applies inline code', async () => {
    const { page, vaultDir } = ctx;
    await typeBody(page, 'code me');
    await selectAll(page);
    await page.getByTestId('fmt-code').click();
    await waitSaved(page);

    expect(readSingleNote(vaultDir)).toContain('`code me`');
  });

  test('creates a bulleted list', async () => {
    const { page, vaultDir } = ctx;
    await typeBody(page, 'bullet item');
    await page.getByTestId('fmt-bullet').click();
    await waitSaved(page);

    expect(readSingleNote(vaultDir)).toContain('- bullet item');
  });

  test('creates a numbered list', async () => {
    const { page, vaultDir } = ctx;
    await typeBody(page, 'ordered item');
    await page.getByTestId('fmt-ordered').click();
    await waitSaved(page);

    expect(readSingleNote(vaultDir)).toContain('1. ordered item');
  });

  test('creates a task list', async () => {
    const { page, vaultDir } = ctx;
    await typeBody(page, 'task item');
    await page.getByTestId('fmt-task').click();
    await waitSaved(page);

    expect(readSingleNote(vaultDir)).toContain('- [ ] task item');
  });

  test('nests a list item with the indent control', async () => {
    const { page, vaultDir } = ctx;
    await typeBody(page, 'parent');
    await page.getByTestId('fmt-bullet').click();
    await page.keyboard.press('Enter');
    await page.keyboard.type('child');
    await page.getByTestId('fmt-indent').click();
    await waitSaved(page);

    const md = readSingleNote(vaultDir);
    expect(md).toContain('- parent');
    expect(md).toContain('  - child');
  });

  test('nests a list item with the Tab key', async () => {
    const { page, vaultDir } = ctx;
    await typeBody(page, 'parent');
    await page.getByTestId('fmt-bullet').click();
    await page.keyboard.press('Enter');
    await page.keyboard.type('child');
    await page.keyboard.press('Tab');
    await waitSaved(page);

    const md = readSingleNote(vaultDir);
    expect(md).toContain('- parent');
    expect(md).toContain('  - child');
  });

  test('outdents a nested list item with the outdent control', async () => {
    const { page, vaultDir } = ctx;
    await typeBody(page, 'parent');
    await page.getByTestId('fmt-bullet').click();
    await page.keyboard.press('Enter');
    await page.keyboard.type('child');
    await page.getByTestId('fmt-indent').click();
    await page.getByTestId('fmt-outdent').click();
    await waitSaved(page);

    const md = readSingleNote(vaultDir);
    expect(md).toContain('- parent');
    expect(md).toContain('- child');
    expect(md).not.toContain('  - child');
  });

  test('caps list nesting at three levels', async () => {
    const { page, vaultDir } = ctx;
    await typeBody(page, 'a');
    await page.getByTestId('fmt-bullet').click();
    await page.keyboard.press('Enter');
    await page.keyboard.type('b');
    await page.getByTestId('fmt-indent').click(); // level 2
    await page.keyboard.press('Enter');
    await page.keyboard.type('c');
    await page.getByTestId('fmt-indent').click(); // level 3
    await page.keyboard.press('Enter');
    await page.keyboard.type('d'); // sibling of c, also level 3

    // At the depth cap the indent control is disabled…
    await expect(page.getByTestId('fmt-indent')).toBeDisabled();
    // …and the Tab key is swallowed rather than nesting deeper.
    await page.keyboard.press('Tab');
    await waitSaved(page);

    const md = readSingleNote(vaultDir);
    expect(md).toContain('- a');
    expect(md).toContain('  - b');
    expect(md).toContain('    - c');
    expect(md).toContain('    - d');
    expect(md).not.toContain('      - d');
  });

  test('round-trips a three-level nested list through the source view', async () => {
    const { page, vaultDir } = ctx;

    await switchView(page, 'source');
    const source = page.getByTestId('source-editor');
    await source.click();
    await source.fill(['- one', '  - two', '    - three'].join('\n'));
    await waitSaved(page);

    // Re-rendered in the WYSIWYG view without flattening…
    await switchView(page, 'wysiwyg');
    await switchView(page, 'source');
    await waitSaved(page);

    const md = readSingleNote(vaultDir);
    expect(md).toContain('- one');
    expect(md).toContain('  - two');
    expect(md).toContain('    - three');
  });

  test('creates a blockquote', async () => {
    const { page, vaultDir } = ctx;
    await typeBody(page, 'quote me');
    await page.getByTestId('fmt-quote').click();
    await waitSaved(page);

    expect(readSingleNote(vaultDir)).toContain('> quote me');
  });

  test('creates a code block', async () => {
    const { page, vaultDir } = ctx;
    await typeBody(page, 'const x = 1');
    await page.getByTestId('fmt-codeblock').click();
    await waitSaved(page);

    const md = readSingleNote(vaultDir);
    expect(md).toContain('```');
    expect(md).toContain('const x = 1');
  });

  test('adds a link to a partial selection via the link dialog', async () => {
    const { page, vaultDir } = ctx;
    await typeBody(page, 'visit the site now');
    await waitSaved(page);

    // Select just the word "site" so the link must apply to the captured range,
    // not the whole paragraph — this guards against the dialog focus trap
    // collapsing the selection before the link is applied.
    await page.getByTestId('editor-content').click();
    await page.keyboard.press('Home');
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
    for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowRight');

    await page.getByTestId('fmt-link').click();
    await page.getByTestId('link-url').fill('https://example.com');
    await page.getByTestId('link-apply').click();
    await waitSaved(page);

    expect(readSingleNote(vaultDir)).toContain('visit the [site](https://example.com) now');
    await expect(page.getByTestId('fmt-link')).toHaveAttribute('aria-pressed', 'true');
  });

  test('inserts a table', async () => {
    const { page, vaultDir } = ctx;
    await page.getByTestId('fmt-table').click();
    await waitSaved(page);

    const md = readSingleNote(vaultDir);
    expect(md).toContain('|');
    expect(md).toMatch(/\|\s*-+\s*\|/);
  });

  test('round-trips Markdown typed in the source view to the WYSIWYG view', async () => {
    const { page, vaultDir } = ctx;

    await switchView(page, 'source');
    const source = page.getByTestId('source-editor');
    await source.click();
    await source.fill('## From Source\n\nbody with **bold** text');
    await waitSaved(page);
    expect(readSingleNote(vaultDir)).toContain('## From Source');

    // Switching to WYSIWYG renders the Markdown.
    await switchView(page, 'wysiwyg');
    const content = page.getByTestId('editor-content');
    await expect(content.getByRole('heading', { level: 2, name: 'From Source' })).toBeVisible();
    await expect(content.locator('strong', { hasText: 'bold' })).toBeVisible();
  });
});
