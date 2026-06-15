import { test, expect } from '@playwright/test';
import { launchApp, type LaunchedApp } from './helpers';

async function expectInDarkMode(
  locator: ReturnType<LaunchedApp['page']['getByTestId']>,
): Promise<void> {
  await expect
    .poll(async () =>
      locator.evaluate((element) => Boolean(element.closest('[data-color-mode="dark"]'))),
    )
    .toBe(true);
}

test.describe('Theme', () => {
  let ctx: LaunchedApp;

  test.beforeEach(async () => {
    ctx = await launchApp();
  });

  test.afterEach(async () => {
    await ctx?.close();
  });

  test('shows the empty editor state on a cold start', async () => {
    await expect(ctx.page.getByTestId('editor-empty')).toBeVisible();
  });

  test('toggles the notes list sidebar from the header', async () => {
    const { page } = ctx;

    await expect(page.getByTestId('new-note-button')).toBeVisible();

    await page.getByTestId('toggle-sidebar').click();
    await expect(page.getByTestId('new-note-button')).toHaveCount(0);

    await page.getByTestId('toggle-sidebar').click();
    await expect(page.getByTestId('new-note-button')).toBeVisible();
  });

  test('remembers the hidden sidebar after a relaunch', async () => {
    const { page } = ctx;

    await page.getByTestId('toggle-sidebar').click();
    await expect(page.getByTestId('new-note-button')).toHaveCount(0);

    const { vaultDir, userDataDir } = ctx;
    await ctx.close({ keepDirs: true });
    ctx = await launchApp({ reuse: { vaultDir, userDataDir } });

    await expect(ctx.page.getByTestId('new-note-button')).toHaveCount(0);
    await ctx.page.getByTestId('toggle-sidebar').click();
    await expect(ctx.page.getByTestId('new-note-button')).toBeVisible();
  });

  test('switches between light and dark color modes', async () => {
    const { page } = ctx;

    await page.getByRole('button', { name: 'Dark' }).click();
    await expect(page.locator('html[data-color-mode="dark"]')).toHaveCount(1);

    await page.getByRole('button', { name: 'Light' }).click();
    await expect(page.locator('html[data-color-mode="light"]')).toHaveCount(1);
  });

  test('follows system appearance changes when preference is auto', async () => {
    const { app, page } = ctx;

    await page.getByRole('button', { name: 'Auto' }).click();

    await app.evaluate(({ nativeTheme }) => {
      nativeTheme.themeSource = 'dark';
    });
    await expect(page.locator('html[data-color-mode="dark"]')).toHaveCount(1);

    await app.evaluate(({ nativeTheme }) => {
      nativeTheme.themeSource = 'light';
    });
    await expect(page.locator('html[data-color-mode="light"]')).toHaveCount(1);

    await app.evaluate(({ nativeTheme }) => {
      nativeTheme.themeSource = 'system';
    });
  });

  test('applies dark mode to dialog and action-menu overlays', async () => {
    const { page } = ctx;

    await page.getByRole('button', { name: 'Dark' }).click();
    await expect(page.locator('html[data-color-mode="dark"]')).toHaveCount(1);

    await page.getByTestId('manage-labels').click();
    const labelDialog = page.getByTestId('label-manager');
    await expect(labelDialog).toBeVisible();
    await expectInDarkMode(labelDialog);

    await page.keyboard.press('Escape');
    await expect(labelDialog).toBeHidden();

    await page.getByTestId('new-note-button').click();
    await page.getByTestId('note-actions').click();
    const deleteItem = page.getByTestId('action-delete');
    await expect(deleteItem).toBeVisible();
    await expectInDarkMode(deleteItem);
  });
});

test.describe('Persistence across relaunch', () => {
  test('remembers the dark color mode after a relaunch', async () => {
    const first = await launchApp();
    await first.page.getByRole('button', { name: 'Dark' }).click();
    await expect(first.page.locator('html[data-color-mode="dark"]')).toHaveCount(1);
    await first.close({ keepDirs: true });

    const second = await launchApp({
      reuse: { vaultDir: first.vaultDir, userDataDir: first.userDataDir },
    });
    await expect(second.page.locator('html[data-color-mode="dark"]')).toHaveCount(1);
    await second.close();
  });

  test('restores the window size after a relaunch', async () => {
    const first = await launchApp();
    await first.app.evaluate(
      ({ BrowserWindow }, size) => {
        BrowserWindow.getAllWindows()[0]?.setBounds(size);
      },
      { width: 880, height: 660 },
    );
    await first.close({ keepDirs: true });

    const second = await launchApp({
      reuse: { vaultDir: first.vaultDir, userDataDir: first.userDataDir },
    });
    const bounds = await second.app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      const b = win!.getBounds();
      return { width: b.width, height: b.height };
    });
    expect(bounds.width).toBe(880);
    expect(bounds.height).toBe(660);
    await second.close();
  });
});
