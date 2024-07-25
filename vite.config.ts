import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { plugin as mdPlugin, Mode as MdMode } from 'vite-plugin-markdown';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

/**
 * For more information, visit: https://vitejs.dev/config
 */
export default defineConfig({
  base: './',
  plugins: [
    tsconfigPaths(),
    react(),
    mdPlugin({
      mode: [MdMode.MARKDOWN],
    }),
    nodePolyfills({
      globals: {
        Buffer: true,
      },
    }),
  ],
});
