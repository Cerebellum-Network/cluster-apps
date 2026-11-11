/// <reference types="vite/client" />

declare module '*.md' {
  const content: string;
  export default content;
}

interface ImportMetaEnv {
  readonly VITE_WALLET_ORIGIN?: string;
  readonly VITE_NETWORK?: string;
  readonly VITE_WALLET_TRANSPORT?: string;
  // Storage slice (src/storage/storageConfig.ts)
  readonly VITE_BLOCKCHAIN_INDEX_URL?: string;
  readonly VITE_DDC_S3_GATEWAY_URL?: string;
  readonly VITE_DDC_CDN_URL?: string;
  readonly VITE_DDC_CLUSTER_ID?: string;
  readonly VITE_STATS_ENDPOINT?: string;
  // Inference / Models slice (src/models/inferenceConfig.ts)
  readonly VITE_INFERENCE_GATEWAY_URL?: string;
  readonly VITE_MODELS_CDN_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Set by `/config.js` before the bundle loads (see src/config.ts). */
interface RuntimeConfig {
  walletOrigin?: string;
  network?: string;
  walletTransport?: 'iframe' | 'popup';
  /** Storage slice (src/storage/storageConfig.ts). */
  storage?: {
    blockchainIndexUrl?: string;
    ddcS3GatewayUrl?: string;
    ddcCdnUrl?: string;
    clusterId?: string;
    statsEndpoint?: string;
  };
  /** Inference / Models slice (src/models/inferenceConfig.ts). */
  inference?: {
    gatewayUrl?: string;
    modelsCdnUrl?: string;
  };
}

interface Window {
  __RUNTIME_CONFIG__?: RuntimeConfig;
}
