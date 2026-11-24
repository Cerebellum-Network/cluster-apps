/**
 * Compute-slice runtime configuration (sandboxes and agents).
 *
 * Same pattern as storage/inference/billing: a deployed build reads these from
 * `/config.js` (`window.__RUNTIME_CONFIG__.compute`, mounted by the Helm chart
 * cef-developer-console), local `npm run dev` falls back to `VITE_*`, then to
 * the Dragon **devnet** default below.
 *
 *   - gatewayUrl   The compute gateway (ddc-node cluster/agent-gateway): the
 *                  public sandbox API under `/v1` (sandboxes, exec, files, logs,
 *                  secrets, egress log, usage records). Every route takes a
 *                  COMPUTE-scoped DDC access token as `Authorization: Bearer`.
 */
const env = import.meta.env;

type ComputeRuntime = { gatewayUrl?: string };

const trim = (v: string) => v.replace(/\/+$/, '');
const runtime =
  (typeof window !== 'undefined' &&
    (window as { __RUNTIME_CONFIG__?: { compute?: ComputeRuntime } }).__RUNTIME_CONFIG__) ||
  {};
const pick = (key: keyof ComputeRuntime, fromEnv: string | undefined, fallback: string) =>
  (runtime.compute?.[key] as string | undefined) || fromEnv || fallback;

export const computeConfig = {
  gatewayUrl: trim(pick('gatewayUrl', env.VITE_COMPUTE_GATEWAY_URL, 'https://agent-gateway.compute.dev.ddcdragon.com')),
};

export type ComputeConfig = typeof computeConfig;
