import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { plugin as mdPlugin, Mode as MdMode } from 'vite-plugin-markdown';

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
  ],
});
