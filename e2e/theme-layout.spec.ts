import { test, expect } from '@playwright/test';
import { launchApp, type LaunchedApp } from './helpers';

test.describe('Theme', () => {
  let ctx: LaunchedApp;

  test.beforeEach(async () => {
    ctx = await launchApp();
  });

  test.afterEach(async () => {
    await ctx.close();
  });

  test('shows the empty editor state on a cold start', async () => {
    await expect(ctx.page.getByTestId('editor-empty')).toBeVisible();
  });

  test('switches between light and dark color modes', async () => {
    const { page } = ctx;

    await page.getByRole('button', { name: 'Dark' }).click();
    await expect(page.locator('[data-color-mode="dark"]')).toHaveCount(1);

    await page.getByRole('button', { name: 'Light' }).click();
    await expect(page.locator('[data-color-mode="light"]')).toHaveCount(1);
  });
});

test.describe('Persistence across relaunch', () => {
  test('remembers the dark color mode after a relaunch', async () => {
    const first = await launchApp();
    await first.page.getByRole('button', { name: 'Dark' }).click();
    await expect(first.page.locator('[data-color-mode="dark"]')).toHaveCount(1);
    await first.close({ keepDirs: true });

    const second = await launchApp({
      reuse: { vaultDir: first.vaultDir, userDataDir: first.userDataDir },
    });
    await expect(second.page.locator('[data-color-mode="dark"]')).toHaveCount(1);
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
