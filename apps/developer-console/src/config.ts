const env = import.meta.env;
const trim = (v: string) => v.replace(/\/$/, '');

/**
 * Deployed builds read their settings at runtime from `/config.js`, which the
 * Helm chart mounts over the image's placeholder (`public/config.js`), so one
 * image serves every environment. Local `npm run dev` falls back to `VITE_*`
 * env vars, then to the Dragon dev defaults.
 *
 * Storage and inference have their own config modules (storage/storageConfig.ts,
 * models/inferenceConfig.ts). This file holds the wallet + network identity only.
 */
const runtime: RuntimeConfig = (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__) || {};
const pick = (key: keyof RuntimeConfig, fromEnv: string | undefined, fallback: string) =>
  (runtime[key] as string | undefined) || fromEnv || fallback;
const transport = (v: string): 'iframe' | 'popup' | undefined => (v === 'iframe' || v === 'popup' ? v : undefined);

export const config = {
  /** CEF wallet origin. Local dev points at the dev wallet, which allowlists localhost. */
  walletOrigin: trim(pick('walletOrigin', env.VITE_WALLET_ORIGIN, 'https://wallet.compute.dev.ddcdragon.com')),
  network: pick('network', env.VITE_NETWORK, 'testnet') as 'testnet' | 'mainnet' | string,
  /**
   * How the wallet SDK reaches the wallet. Unset lets the SDK choose (iframe on
   * https). A framed sign-in is only accepted from origins in wallet-api's
   * WALLET_API_EMBED_TOP_ORIGINS (the dev wallet allowlists https://localhost:5173).
   */
  walletTransport: transport(pick('walletTransport', env.VITE_WALLET_TRANSPORT, '')),
  appId: 'developer-console',
  appName: 'Developer Console',
};
