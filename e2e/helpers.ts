import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export interface LaunchedApp {
  app: ElectronApplication;
  page: Page;
  vaultDir: string;
  close: () => Promise<void>;
}

/**
 * Launch the built Inkwell app with an isolated vault and user-data directory,
 * so E2E runs never touch the real notes vault.
 */
export async function launchApp(): Promise<LaunchedApp> {
  const vaultDir = mkdtempSync(join(tmpdir(), 'inkwell-vault-'));
  const userDataDir = mkdtempSync(join(tmpdir(), 'inkwell-data-'));

  const app = await electron.launch({
    args: [join(ROOT, 'out/main/index.js'), `--user-data-dir=${userDataDir}`],
    env: {
      ...process.env,
      INKWELL_VAULT_DIR: vaultDir,
    },
  });

  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="new-note-button"]');

  return {
    app,
    page,
    vaultDir,
    close: async () => {
      await app.close();
      rmSync(vaultDir, { recursive: true, force: true });
      rmSync(userDataDir, { recursive: true, force: true });
    },
  };
}
