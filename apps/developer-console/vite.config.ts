import * as path from 'path';
import { defineConfig, searchForWorkspaceRoot } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const rootDir = searchForWorkspaceRoot(__dirname);
const outDir = path.join(rootDir, 'dist', path.basename(__dirname));

/**
 * For more information, visit: https://vitejs.dev/config
 */
export default defineConfig(({ mode }) => {
  // Force production mode
  const environment = 'prod';
  process.env.NODE_ENV = 'production';
  
  const apiEndpoints = {
    dev: {
      indexer: 'https://subsquid.devnet.cere.network',
      faucet: 'https://dev-faucet-service.network-dev.aws.cere.io',
      stats: 'https://dac.devnet.ddc-dragon.com',
      clusterManagement: 'https://dev-cluster-management.network-dev.aws.cere.io'
    },
    stage: {
      indexer: 'https://subsquid.testnet.cere.network',
      faucet: 'https://stage-faucet-service.network-stage.aws.cere.io',
      stats: 'https://dac.testnet.cere.network',
      clusterManagement: 'https://stage-cluster-management.network-stage.aws.cere.io'
    },
    prod: {
      indexer: 'https://subsquid.cere.network',
      faucet: 'https://faucet-service.network.aws.cere.io',
      stats: 'https://dac.ddc-dragon.com',
      clusterManagement: 'https://cluster-management.cere.io'
    }
  };

  const endpoints = apiEndpoints[environment] || apiEndpoints.prod;
  
  return {
    base: './',
    assetsInclude: ['**/*.md'],
    envDir: rootDir,
    mode: environment,
    build: { 
      outDir, 
      emptyOutDir: true 
    },
    server: {
      proxy: {
        '/graphql': {
          target: endpoints.indexer,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/graphql/, '/graphql')
        },
        '/faucet': {
          target: endpoints.faucet,
          changeOrigin: true,
          secure: false
        },
        '/stats': {
          target: endpoints.stats,
          changeOrigin: true,
          secure: false
        },
        '/email-campaigns': {
          target: endpoints.clusterManagement,
          changeOrigin: true,
          secure: false
        }
      }
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
  };
});
