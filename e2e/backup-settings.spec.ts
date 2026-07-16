import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, openSettings, type LaunchedApp } from './helpers';

test.describe('Backup settings', () => {
  let ctx: LaunchedApp;

  test.beforeEach(async () => {
    ctx = await launchApp();
  });

  test.afterEach(async () => {
    await ctx?.close();
  });

  test('renders the backup section and enables version history end-to-end', async () => {
    const { page, vaultDir } = ctx;

    await openSettings(page);

    // The Backup & Sync section and its wired-up controls render.
    await expect(page.getByRole('heading', { name: 'Backup & Sync' })).toBeVisible();
    await expect(page.getByTestId('backup-status-pill')).toBeVisible();
    const toggle = page.getByTestId('backup-enabled-toggle');
    await expect(toggle).toBeVisible();
    await expect(toggle).not.toBeChecked();

    // Toggling "Keep version history" drives the full preload→main→renderer
    // flow. The checkbox is controlled by the async IPC round-trip, so click
    // once and poll rather than using check()'s synchronous state assertion:
    // the auto-commit options appear and a git repo is initialised on disk.
    await toggle.click();
    await expect(toggle).toBeChecked();
    await expect(page.getByText('Automatically as I write (recommended)')).toBeVisible();

    await expect.poll(() => existsSync(join(vaultDir, '.git'))).toBe(true);
  });
});
