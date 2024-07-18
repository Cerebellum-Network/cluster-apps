import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import svgr from 'vite-plugin-svgr';

/**
 * For more information, visit: https://vitejs.dev/config
 */
export default defineConfig({
  base: './',
  plugins: [tsconfigPaths(), react(), svgr({
    svgrOptions: { exportType: 'default', ref: true, svgo: false, titleProp: true },
    include: '**/*.svg',
  })],
});
