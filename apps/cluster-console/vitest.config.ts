import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

/** Pure-logic tests in a node environment (no React plugin, no polyfills). */
export default defineConfig({
  plugins: [tsconfigPaths({ root: __dirname })],
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { 'lottie-react': new URL('./test/lottieStub.ts', import.meta.url).pathname } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
