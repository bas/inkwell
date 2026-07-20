import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, openSettings, type LaunchedApp } from './helpers';

// Enabling version history shells out to `git`, so guard this suite the same
// way the git integration tests do (src/main/git/service.test.ts) and skip it
// on minimal runners where the binary isn't installed/resolvable.
const hasGit = ((): boolean => {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

test.describe('Backup settings', () => {
  test.skip(!hasGit, 'git binary not available on this runner');

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

  test('shows a prominent Connect a GitHub repository CTA before history is on', async () => {
    const { page } = ctx;

    await openSettings(page);

    // With version history still off, the prominent connect CTA is the discoverable
    // path to setting up a GitHub upstream.
    await expect(page.getByTestId('backup-enabled-toggle')).not.toBeChecked();
    await expect(page.getByTestId('backup-connect-remote')).toBeVisible();

    // The Notes vault section exposes the current vault and a way to change it.
    await expect(page.getByRole('heading', { name: 'Notes vault' })).toBeVisible();
    await expect(page.getByTestId('vault-change-location')).toBeVisible();
  });
});
