/**
 * Inference-slice runtime configuration.
 *
 * Same pattern as storage/billing: a deployed build reads these from
 * `/config.js` (`window.__RUNTIME_CONFIG__.inference`, mounted by the Helm
 * chart), local `npm run dev` falls back to `VITE_*`, then to the Dragon
 * **devnet** defaults below (matching dragon-ansible dragon1-devnet:
 * inference gateway at `<svc>.<ingress_host>` and
 * `developer_console_inference_models_cdn_url`).
 *
 *   - gatewayUrl     Inference Gateway: GET /api/v1/models, the OpenAI/Anthropic
 *                    surfaces, and POST /api/v1/inference (a COMPUTE-scoped DDC
 *                    access token as Bearer — ddc-node #1004).
 *   - modelsCdnUrl   CDN serving published model manifests at
 *                    `{cdn}/{bucket}/models/{name}/{version}/model.json`
 *                    (pricing, context window, task, sovereign/remote).
 */
const env = import.meta.env;

type InferenceRuntime = { gatewayUrl?: string; modelsCdnUrl?: string };

const trim = (v: string) => v.replace(/\/+$/, '');
const runtime =
  (typeof window !== 'undefined' &&
    (window as { __RUNTIME_CONFIG__?: { inference?: InferenceRuntime } }).__RUNTIME_CONFIG__) ||
  {};
const pick = (key: keyof InferenceRuntime, fromEnv: string | undefined, fallback: string) =>
  (runtime.inference?.[key] as string | undefined) || fromEnv || fallback;

export const inferenceConfig = {
  gatewayUrl: trim(pick('gatewayUrl', env.VITE_INFERENCE_GATEWAY_URL, 'https://inference-gateway.compute.dev.ddcdragon.com')),
  modelsCdnUrl: trim(pick('modelsCdnUrl', env.VITE_MODELS_CDN_URL, 'https://cdn.dragon-1.xyz')),
};

export type InferenceConfig = typeof inferenceConfig;
