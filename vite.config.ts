import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * For more information, visit: https://vitejs.dev/config
 */
export default defineConfig({
  base: './',
  plugins: [tsconfigPaths(), react()],
});
