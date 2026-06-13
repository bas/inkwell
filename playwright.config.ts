import { defineConfig } from '@playwright/test';

/**
 * Playwright config for Electron end-to-end tests.
 *
 * Tests launch the built app from `out/`, so `npm run build` must run first.
 * Each test gets an isolated vault and Electron user-data directory.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
});
