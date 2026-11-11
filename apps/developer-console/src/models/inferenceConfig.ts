/**
 * Inference / Models runtime configuration (Developer Console Phase 1).
 *
 * Same runtime-config pattern as src/storage/storageConfig.ts: a deployed build
 * reads `/config.js` (`window.__RUNTIME_CONFIG__.inference`, mounted by the Helm
 * chart), a local `npm run dev` falls back to `VITE_*`, then to the Dragon
 * testnet defaults below. The deploy plumbing already exists -- the chart emits
 * `inference: { gatewayUrl, modelsCdnUrl }` and ansible sets `VITE_INFERENCE_*`.
 *
 * Declared with a local runtime type rather than the app-wide ambient
 * `RuntimeConfig`, so the module compiles in any consumer (same reasoning as
 * storageConfig: keep the storage/inference slices self-contained).
 */
type InferenceRuntime = {
  gatewayUrl?: string;
  modelsCdnUrl?: string;
};

const env = import.meta.env;
const trim = (v: string) => v.replace(/\/$/, '');
const runtime =
  (typeof window !== 'undefined' &&
    (window as { __RUNTIME_CONFIG__?: { inference?: InferenceRuntime } }).__RUNTIME_CONFIG__) ||
  {};

export const inferenceConfig = {
  /** Inference gateway: model catalog `GET /api/v1/models`, inference routing. */
  gatewayUrl: trim(
    runtime.inference?.gatewayUrl ||
      env.VITE_INFERENCE_GATEWAY_URL ||
      'https://inference-gateway.compute.test.ddcdragon.com',
  ),
  /**
   * Models CDN serving the published `model.json` manifests. Points at
   * `cdn.dragon-1.xyz` (NOT ROC's dead `cdn.ddc-dragon.com`: the brief says copy
   * ROC's code, not its config).
   */
  modelsCdnUrl: trim(runtime.inference?.modelsCdnUrl || env.VITE_MODELS_CDN_URL || 'https://cdn.dragon-1.xyz'),
};

export type InferenceConfig = typeof inferenceConfig;
