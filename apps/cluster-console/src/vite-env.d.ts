/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONSOLE_BACKEND_URL?: string;
  readonly VITE_WALLET_ORIGIN?: string;
  readonly VITE_WALLET_TRANSPORT?: string;
  readonly VITE_NETWORK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Set by `/config.js` before the bundle loads (see src/config.ts). */
interface RuntimeConfig {
  consoleBackendUrl?: string;
  walletOrigin?: string;
  walletTransport?: 'iframe' | 'popup';
  network?: string;
}

interface Window {
  __RUNTIME_CONFIG__?: RuntimeConfig;
}
