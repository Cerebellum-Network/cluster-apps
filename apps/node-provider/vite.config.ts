import * as path from 'path';
import { defineConfig, searchForWorkspaceRoot } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

const rootDir = searchForWorkspaceRoot(__dirname);
const outDir = path.join(rootDir, 'dist', path.basename(__dirname));

/**
 * For more information, visit: https://vitejs.dev/config
 */
export default defineConfig({
  base: './',
  envDir: rootDir,
  build: { outDir, emptyOutDir: true },
  plugins: [tsconfigPaths({ root: __dirname }), react()],
});
