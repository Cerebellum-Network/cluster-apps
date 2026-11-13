import { defineConfig } from 'vitest/config';

/**
 * Standalone test config (does NOT extend vite.config.ts): the unit tests here
 * cover pure storage-layer logic, so they need neither the React plugin nor the
 * node polyfills, and a plain node environment keeps them fast and isolated.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
