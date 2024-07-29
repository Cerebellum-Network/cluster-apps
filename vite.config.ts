import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { viteStaticCopy } from 'vite-plugin-static-copy';

/**
 * For more information, visit: https://vitejs.dev/config
 */
export default defineConfig({
  base: './',
  assetsInclude: ['**/*.md'],
  plugins: [
    tsconfigPaths(),
    react(),
    nodePolyfills({
      globals: {
        Buffer: true,
      },
    }),
    // viteStaticCopy({
    //   targets: [
    //     {
    //       src: 'src/assets/*',
    //       dest: 'assets',
    //     },
    //   ],
    // }),
  ],
});
