const env = import.meta.env;
const trim = (v: string) => v.replace(/\/$/, '');

/**
 * Deployed builds read their settings at runtime from `/config.js` (the Helm
 * chart mounts it over the image's placeholder), so one image serves every
 * cluster. Local `npm start` falls back to `VITE_*`, then to Dragon 1 devnet.
 */
const runtime: RuntimeConfig = (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__) || {};
const pick = (key: keyof RuntimeConfig, fromEnv: string | undefined, fallback: string) =>
  (runtime[key] as string | undefined) || fromEnv || fallback;
const transport = (v: string): 'iframe' | 'popup' | undefined => (v === 'iframe' || v === 'popup' ? v : undefined);

export const config = {
  /** This cluster's console backend (one per cluster). */
  consoleBackendUrl: trim(
    pick('consoleBackendUrl', env.VITE_CONSOLE_BACKEND_URL, 'https://console-backend.compute.dev.ddcdragon.com'),
  ),
  /** SSCP wallet origin. */
  walletOrigin: trim(pick('walletOrigin', env.VITE_WALLET_ORIGIN, 'https://wallet.compute.dev.ddcdragon.com')),
  /**
   * Unset lets the wallet SDK choose: the iframe on https. A framed sign-in is
   * accepted only from origins on wallet-api's WALLET_API_EMBED_TOP_ORIGINS (the
   * dev wallet allows https://localhost:5173); `popup` is the fallback.
   */
  walletTransport: transport(pick('walletTransport', env.VITE_WALLET_TRANSPORT, '')),
  network: pick('network', env.VITE_NETWORK, 'devnet'),
  /** The console's own wallet app id, never the developer console's. */
  appId: 'cluster-console',
  appName: 'Cluster Console',
};
