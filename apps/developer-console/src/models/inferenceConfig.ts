/**
 * Inference runtime configuration (Developer Console Phase 1 -- Models).
 *
 * Same runtime-config pattern as src/config.ts and src/storage/storageConfig.ts:
 * a deployed build reads `/config.js` (`window.__RUNTIME_CONFIG__.inference`),
 * local dev falls back to `VITE_*`, then to the Dragon-testnet default.
 */
const env = import.meta.env;
const trim = (v: string) => v.replace(/\/$/, '');
const runtime = (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__) || {};

export const inferenceConfig = {
  /** Inference gateway: model catalog `GET /api/v1/models`, inference routing. */
  gatewayUrl: trim(
    runtime.inference?.gatewayUrl ||
      env.VITE_INFERENCE_GATEWAY_URL ||
      'https://inference-gateway.compute.test.ddcdragon.com',
  ),
  /**
   * Models CDN serving the published `model.json` manifests. The model bucket
   * (1338) lives on the mainnet DDC cluster, so this is shared across cells;
   * the old `cdn.ddc-dragon.com` is being deleted in favour of `cdn.dragon-1.xyz`.
   */
  modelsCdnUrl: trim(
    runtime.inference?.modelsCdnUrl || env.VITE_MODELS_CDN_URL || 'https://cdn.dragon-1.xyz',
  ),
};

export type InferenceConfig = typeof inferenceConfig;
