import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * Standalone test config (does NOT extend vite.config.ts): the unit tests here
 * cover pure logic, so they need neither the React plugin nor the node
 * polyfills, and a plain node environment keeps them fast and isolated. The
 * tsconfig paths resolve `~/…` and `@cluster-apps/ui` for the one render test
 * (`*.test.tsx`), which server-renders a page with fixture data.
 */
export default defineConfig({
  plugins: [tsconfigPaths({ root: __dirname })],
  esbuild: { jsx: 'automatic' },
  // @cluster-apps/ui's barrel imports lottie-react (lottie-web), which needs a DOM at import time.
  resolve: { alias: { 'lottie-react': new URL('./test/lottieStub.ts', import.meta.url).pathname } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
