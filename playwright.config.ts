import { defineConfig } from '@playwright/test';

const isCI = !!process.env['CI'];

/**
 * Playwright config for Electron end-to-end tests.
 *
 * Tests launch the built app from `out/`, so `npm run build` must run first.
 * Each test gets an isolated vault and Electron user-data directory.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: isCI,
  workers: isCI ? 2 : 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? 'github' : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
});
