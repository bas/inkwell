import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
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
const APP_ENTRY = join(ROOT, 'out/main/index.js');

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
  if (!existsSync(APP_ENTRY)) {
    throw new Error(
      `Built Electron app not found at ${APP_ENTRY}. Run "npm run build" in this worktree before launching E2E tests.`,
    );
  }

  const vaultDir = options.reuse?.vaultDir ?? mkdtempSync(join(tmpdir(), 'inkwell-vault-'));
  const userDataDir = options.reuse?.userDataDir ?? mkdtempSync(join(tmpdir(), 'inkwell-data-'));

  const app = await electron.launch({
    args: [APP_ENTRY, `--user-data-dir=${userDataDir}`],
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
  await page.waitForSelector('[data-testid="toggle-sidebar"]');

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
  await expect(page.getByTestId('editor-content')).toBeVisible();
}

/**
 * Set the note title. Notes are body-first: the title is the first line of the
 * editor content (rendered as an H1), so this types into that leading line. Call
 * it on a fresh note before typing the body.
 */
export async function setTitle(page: Page, text: string): Promise<void> {
  const content = page.getByTestId('editor-content');
  await content.click();
  await page.keyboard.type(text);
}

/**
 * Click into the WYSIWYG editor and type body text on a new line below the
 * title, so the body stays a distinct block from the leading title line.
 */
export async function typeBody(page: Page, text: string): Promise<void> {
  const body = page.getByTestId('editor-content');
  await body.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type(text);
}

/** Wait for autosave to settle into the saved/clean UI state. */
export async function waitSaved(page: Page): Promise<void> {
  let sawPending = false;
  await expect
    .poll(
      async () => {
        const text = (await page.getByTestId('save-state').textContent())?.trim() ?? '';
        if (text === 'Saving…' || text === 'Unsaved changes') {
          sawPending = true;
          return '__pending__';
        }
        return sawPending ? text : '__waiting_for_save__';
      },
      { timeout: 15_000 },
    )
    .toMatch(/^(Saved|Updated )/);
}

/** Assert whether the note list includes a note title, ignoring snippets and timestamps. */
export async function expectNoteListTitle(
  page: Page,
  title: string,
  present: boolean,
): Promise<void> {
  const titleLocator = page
    .getByTestId('note-list')
    .getByTestId('note-title')
    .filter({ hasText: new RegExp(`^${escapeRegExp(title)}$`) });
  await expect(titleLocator).toHaveCount(present ? 1 : 0);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
