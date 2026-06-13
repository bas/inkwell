import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@renderer': fileURLToPath(new URL('./src/renderer/src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
    },
  },
  test: {
    // Default to the fast node env; renderer component tests opt into jsdom via
    // a `// @vitest-environment jsdom` docblock at the top of the file.
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    passWithNoTests: true,
  },
});
