/**
 * Inference Gateway + model-manifest CDN client. Ported from ROC
 * (src/features/models/inferenceGatewayApi.ts), trimmed to the read surface the
 * Models page needs. Both hosts are public for GET, so plain `fetch`, no auth.
 *
 *  - gateway (`inferenceConfig.gatewayUrl`) lists models and routes inference,
 *  - CDN (`inferenceConfig.modelsCdnUrl`) serves published `model.json` manifests.
 */
import { inferenceConfig as config } from './inferenceConfig';

/** One replica backing a model version, as reported by the gateway. */
export interface GatewayReplica {
  nodeId: string;
  status: string;
  healthy: boolean;
  lastSeen: string;
  routable: boolean;
}

export type GatewayModelStatus = 'available' | 'busy' | 'saturated' | 'unavailable';

/** A single model version as returned by the gateway's /api/v1/models listing. */
export interface GatewayModel {
  id: string;
  bucket: number;
  name: string;
  version: string;
  available: boolean;
  routableReplicas: number;
  replicas: GatewayReplica[];
  /** Capacity over the routable replicas (IG #1319); absent on an older gateway. */
  status?: GatewayModelStatus;
  /** Summed concurrency ceiling the runtimes report; 0 when unknown. */
  ceiling?: number;
  inFlight?: number;
  queueDepth?: number;
  alias?: string;
}

/** The published `model.json` manifest (best-effort — many fields optional). */
export type ModelManifest = {
  name: string;
  version: string;
  description?: string;
  framework?: string;
  task?: string;
  stream?: boolean;
  handler?: string;
  alias?: string;
  pricing?: { unit?: string; inputCost?: number; outputCost?: number };
  /** Context window and output cap the gateway enforces for a chat model. */
  max_input_tokens?: number;
  max_output_tokens?: number;
  /** False when the model runs at an external provider (`framework: "remote"`). */
  sovereign?: boolean;
  remote?: { pool?: string };
} & Record<string, unknown>;

/** GET the full model catalogue from the gateway. */
export async function listModels(): Promise<GatewayModel[]> {
  // `no-store`: replica availability/versions change server-side; always fresh.
  const res = await fetch(`${config.gatewayUrl}/api/v1/models`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load models: ${res.status} ${res.statusText}`);
  const body = (await res.json()) as { count?: number; models?: GatewayModel[] };
  return body.models ?? [];
}

/**
 * Fetch a model's CDN manifest. Returns null on any non-OK response or parse
 * error so a missing/404 manifest degrades gracefully (the model still shows,
 * just without price/context enrichment). The URL is built verbatim from the
 * gateway model's own bucket/name/version — the gateway reports the value the
 * CDN expects.
 */
export async function getModelManifest(bucket: number, name: string, version: string): Promise<ModelManifest | null> {
  try {
    const res = await fetch(`${config.modelsCdnUrl}/${bucket}/models/${name}/${version}/model.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as ModelManifest;
  } catch {
    return null;
  }
}

/** The OpenAI-compatible base URL developers point their SDK at ("Show me how"). */
export const openAiBaseUrl = () => `${config.gatewayUrl}/openai/v1`;

/**
 * The Anthropic-compatible base URL (the Anthropic SDK's `base_url`, Claude
 * Code's `ANTHROPIC_BASE_URL`). It stops at `/anthropic` on purpose — the SDK
 * appends `/v1/messages` itself, so the live endpoint is `…/anthropic/v1/messages`
 * (the OpenAI SDK, by contrast, wants the `/v1` included — see `openAiBaseUrl`).
 */
export const anthropicBaseUrl = () => `${config.gatewayUrl}/anthropic`;

/** Speech models' plain-HTTP endpoint (no OpenAI/Anthropic SDK) — POST inference. */
export const speechHttpUrl = () => `${config.gatewayUrl}/api/v1/inference`;
