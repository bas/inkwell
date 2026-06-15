import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  _electron as electron,
  expect,
  type ElectronApplication,
  type Page,
} from '@playwright/test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export interface LaunchOptions {
  /** Reuse existing directories instead of creating fresh ones (for persistence/relaunch tests). */
  reuse?: { vaultDir: string; userDataDir: string };
  /** Extra environment variables for the Electron main process (e.g. test seams). */
  env?: Record<string, string>;
}

export interface LaunchedApp {
  app: ElectronApplication;
  page: Page;
  vaultDir: string;
  userDataDir: string;
  /** Close the app. Pass `{ keepDirs: true }` to leave temp dirs on disk for a later relaunch. */
  close: (opts?: { keepDirs?: boolean }) => Promise<void>;
}

/**
 * Launch the built Inkwell app with an isolated vault and user-data directory,
 * so E2E runs never touch the real notes vault.
 */
export async function launchApp(options: LaunchOptions = {}): Promise<LaunchedApp> {
  const vaultDir = options.reuse?.vaultDir ?? mkdtempSync(join(tmpdir(), 'inkwell-vault-'));
  const userDataDir = options.reuse?.userDataDir ?? mkdtempSync(join(tmpdir(), 'inkwell-data-'));

  const app = await electron.launch({
    args: [join(ROOT, 'out/main/index.js'), `--user-data-dir=${userDataDir}`],
    env: {
      ...process.env,
      INKWELL_VAULT_DIR: vaultDir,
      ...options.env,
    },
  });

  // Surface the Electron main-process output so a startup crash (e.g. a native
  // module ABI mismatch) shows the real reason instead of an opaque
  // `firstWindow` timeout.
  const child = app.process();
  child.stdout?.on('data', (chunk) => process.stdout.write(`[electron stdout] ${chunk}`));
  child.stderr?.on('data', (chunk) => process.stderr.write(`[electron stderr] ${chunk}`));

  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="new-note-button"]');

  return {
    app,
    page,
    vaultDir,
    userDataDir,
    close: async ({ keepDirs = false } = {}) => {
      await app.close();
      if (!keepDirs) {
        rmSync(vaultDir, { recursive: true, force: true });
        rmSync(userDataDir, { recursive: true, force: true });
      }
    },
  };
}

// --- Disk helpers -----------------------------------------------------------

/** Concatenated contents of every `.md` file in the vault (asserts at least one exists). */
export function readVaultMarkdown(vaultDir: string): string {
  const files = readdirSync(vaultDir).filter((name) => name.endsWith('.md'));
  expect(files.length).toBeGreaterThan(0);
  return files.map((name) => readFileSync(join(vaultDir, name), 'utf8')).join('\n');
}

/** Number of `.md` files currently in the vault. */
export function countVaultNotes(vaultDir: string): number {
  return readdirSync(vaultDir).filter((name) => name.endsWith('.md')).length;
}

/** Contents of the single `.md` note in the vault (asserts exactly one exists). */
export function readSingleNote(vaultDir: string): string {
  const files = readdirSync(vaultDir).filter((name) => name.endsWith('.md'));
  expect(files.length).toBe(1);
  return readFileSync(join(vaultDir, files[0]!), 'utf8');
}

// --- Action helpers ---------------------------------------------------------

/** Create a fresh note and wait for the editor to be ready. */
export async function createNote(page: Page): Promise<void> {
  await page.getByTestId('new-note-button').click();
  await expect(page.getByTestId('editor-title')).toBeVisible();
}

/** Replace the note title. */
export async function setTitle(page: Page, text: string): Promise<void> {
  await page.getByTestId('editor-title').fill(text);
}

/** Click into the WYSIWYG editor and type body text. */
export async function typeBody(page: Page, text: string): Promise<void> {
  const body = page.getByTestId('editor-content');
  await body.click();
  await page.keyboard.type(text);
}

/** Wait for autosave to settle (save-state shows "Saved"). */
export async function waitSaved(page: Page): Promise<void> {
  await expect(page.getByTestId('save-state')).toHaveText('Saved', { timeout: 15_000 });
}

/** Switch the editor between the WYSIWYG and Markdown source views. */
export async function switchView(page: Page, view: 'wysiwyg' | 'source'): Promise<void> {
  await page.getByTestId(view === 'wysiwyg' ? 'view-wysiwyg' : 'view-source').click();
}

/** Read the OS clipboard text from the main process. */
export async function readClipboard(app: ElectronApplication): Promise<string> {
  return app.evaluate(({ clipboard }) => clipboard.readText());
}

/** Open the note overflow menu and choose "Summarize with Copilot". */
export async function openSummary(page: Page): Promise<void> {
  await page.getByTestId('note-actions').click();
  await page.getByTestId('action-summarize').click();
  await expect(page.getByTestId('ai-summary-dialog')).toBeVisible();
}

/** Open the note overflow menu and choose "Review with Copilot". */
export async function openReview(page: Page): Promise<void> {
  await page.getByTestId('note-actions').click();
  await page.getByTestId('action-review').click();
  await expect(page.getByTestId('ai-review-dialog')).toBeVisible();
}
