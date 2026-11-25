/**
 * Compute-slice runtime configuration (sandboxes and agents).
 *
 * Same pattern as storage/inference/billing: a deployed build reads these from
 * `/config.js` (`window.__RUNTIME_CONFIG__.compute`, mounted by the Helm chart
 * cef-developer-console), local `npm run dev` falls back to `VITE_*`, then to
 * the compute gateway of the console's network (`config.network`), if that
 * network has one.
 *
 *   - gatewayUrl   The compute gateway (ddc-node cluster/agent-gateway): the
 *                  public sandbox API under `/v1` (sandboxes, exec, files, logs,
 *                  secrets, egress log, usage records). Every route takes a
 *                  COMPUTE-scoped DDC access token as `Authorization: Bearer`.
 *
 * The default follows the network on purpose: the token is minted for a bucket
 * of the console's network, and a gateway of another network does not know
 * that bucket. A console on a network without sandboxes gets no gateway, and
 * the Sandboxes and Agents pages say so (`isComputeConfigured`), rather than
 * reading buckets on one chain and calling a gateway on another.
 */
import { config } from '~/config';

const env = import.meta.env;

type ComputeRuntime = { gatewayUrl?: string };

/** The compute gateway of each network that runs sandboxes. */
export const GATEWAY_BY_NETWORK: Readonly<Record<string, string>> = {
  devnet: 'https://agent-gateway.compute.dev.ddcdragon.com',
};

const trim = (v: string) => v.replace(/\/+$/, '');
const runtime =
  (typeof window !== 'undefined' &&
    (window as { __RUNTIME_CONFIG__?: { compute?: ComputeRuntime } }).__RUNTIME_CONFIG__) ||
  {};

/** The gateway for `network`: the configured one, else that network's own, else none (''). */
export function computeGatewayUrl(network: string, configured?: string): string {
  return trim(configured || GATEWAY_BY_NETWORK[network] || '');
}

export const computeConfig = {
  gatewayUrl: computeGatewayUrl(config.network, runtime.compute?.gatewayUrl || env.VITE_COMPUTE_GATEWAY_URL),
  /** The network whose buckets the console bills (config.network). */
  network: config.network,
};

/** Whether this console has a compute gateway (sandboxes and agents) at all. */
export const isComputeConfigured = (): boolean => !!computeConfig.gatewayUrl;

export type ComputeConfig = typeof computeConfig;
