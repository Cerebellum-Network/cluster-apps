import * as fs from 'node:fs';
import * as path from 'path';
import { defineConfig, searchForWorkspaceRoot } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const rootDir = searchForWorkspaceRoot(__dirname);
const outDir = path.join(rootDir, 'dist', path.basename(__dirname));

// Optional local https for `npm run dev`: point DEV_HTTPS_CERT / DEV_HTTPS_KEY at
// a cert + key (e.g. from mkcert). The CEF wallet's passkey (WebAuthn) refuses
// non-TLS origins, so wallet sign-in/signing only works over https locally.
const certPath = process.env.DEV_HTTPS_CERT;
const keyPath = process.env.DEV_HTTPS_KEY;
const https =
  certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath)
    ? { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }
    : undefined;

/**
 * For more information, visit: https://vitejs.dev/config
 */
export default defineConfig({
  base: './',
  assetsInclude: ['**/*.md'],
  envDir: rootDir,
  ...(https ? { server: { https } } : {}),
  build: { outDir, emptyOutDir: true },
  optimizeDeps: {
    include: ['date-fns'],
  },
  plugins: [
    tsconfigPaths({ root: __dirname }),
    react(),
    nodePolyfills({
      globals: {
        Buffer: true,
      },
    }),
  ],
});
