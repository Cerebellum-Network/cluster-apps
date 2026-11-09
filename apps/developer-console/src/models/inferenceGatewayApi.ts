/**
 * Inference-gateway model-catalog client (Phase 1).
 *
 * Ported (trimmed) from ROC's src/features/models/inferenceGatewayApi.ts. The
 * gateway is public for GET, so plain `fetch`, no auth. Manifest enrichment
 * (the CDN model.json) is left out of this minimal catalog.
 */
import { inferenceConfig } from './inferenceConfig';

/** One replica backing a model version, as reported by the gateway. */
export interface GatewayReplica {
  nodeId: string;
  status: string;
  healthy: boolean;
  lastSeen: string;
  routable: boolean;
}

export type GatewayModelStatus = 'available' | 'busy' | 'saturated' | 'unavailable';

/** A single model version as returned by the gateway's /models listing. */
export interface GatewayModel {
  id: string;
  bucket: number;
  name: string;
  version: string;
  available: boolean;
  routableReplicas: number;
  replicas: GatewayReplica[];
  status?: GatewayModelStatus;
  ceiling?: number;
  inFlight?: number;
  queueDepth?: number;
}

export interface ModelCatalog {
  models: GatewayModel[];
  /** How long a request waits for a slot at a busy model before its 429; 0 when off. */
  maxWaitSeconds?: number;
}

/** The published `model.json` manifest (best-effort -- most fields optional). */
export interface ModelManifest {
  name: string;
  version: string;
  description?: string;
  framework?: string;
  task?: string;
  stream?: boolean;
  alias?: string;
  pricing?: { unit?: string; inputCost?: number; outputCost?: number };
  max_input_tokens?: number;
  max_output_tokens?: number;
  sovereign?: boolean;
}

export interface InferenceModelRef {
  bucket: number;
  name: string;
  version: string;
}

/**
 * POST an inference request to the gateway. Body: `{ model, inputs }` where
 * `inputs` is an object keyed by the model's tensor/param names. `apiKey` (a
 * COMPUTE bearer scoped to a bucket) is required for non-public models. Returns
 * parsed JSON, or raw text when the body isn't JSON.
 */
export async function runInference(model: InferenceModelRef, inputs: unknown, apiKey?: string): Promise<unknown> {
  const res = await fetch(`${inferenceConfig.gatewayUrl}/api/v1/inference`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ model, inputs }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Inference failed: ${res.status}${text ? ` — ${text.slice(0, 300)}` : ''}`);
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

// ── Usage & limits ──────────────────────────────────────────────────────────
export interface Limit {
  maxInFlight: number;
  /** 0 means no token budget. */
  tokensPerMinute: number;
}
export interface ModelLimits {
  /** "bucket/name/version". */
  model: string;
  limit: Limit;
  inFlight: number;
  queued: number;
  tokensLastMinute: number;
  modelStatus: { status: string; ceiling: number; inFlight: number };
}
export interface BucketLimits {
  bucket: number;
  profile: string;
  /** False when the gateway reports the limits without enforcing them. */
  enabled: boolean;
  maxWaitSeconds?: number;
  models: ModelLimits[];
}

/** GET /api/v1/limits for the key's bucket (usage held against the profile's limit). */
export async function getLimits(apiKey: string): Promise<BucketLimits> {
  const res = await fetch(`${inferenceConfig.gatewayUrl}/api/v1/limits`, {
    headers: { authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Limits failed: ${res.status}${text ? ` — ${text.slice(0, 300)}` : ''}`);
  const body = (text ? JSON.parse(text) : {}) as Partial<BucketLimits>;
  return {
    bucket: Number(body.bucket ?? 0),
    profile: String(body.profile ?? ''),
    enabled: body.enabled !== false,
    maxWaitSeconds: typeof body.maxWaitSeconds === 'number' ? body.maxWaitSeconds : undefined,
    models: Array.isArray(body.models) ? body.models : [],
  };
}

/**
 * Fetch a model's CDN manifest, or null on any non-OK / parse error so a missing
 * manifest degrades gracefully. The path uses the gateway model's own
 * bucket/name/version verbatim (the gateway reports the value the CDN expects).
 */
export async function getModelManifest(
  bucket: number,
  name: string,
  version: string,
): Promise<ModelManifest | null> {
  try {
    const res = await fetch(`${inferenceConfig.modelsCdnUrl}/${bucket}/models/${name}/${version}/model.json`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as ModelManifest;
  } catch {
    return null;
  }
}

/** GET the full model catalogue from the gateway. */
export async function listModelCatalog(): Promise<ModelCatalog> {
  // no-store: replica availability/versions change server-side; always fetch fresh.
  const res = await fetch(`${inferenceConfig.gatewayUrl}/api/v1/models`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load models: ${res.status} ${res.statusText}`);
  const body = (await res.json()) as { count?: number; models?: GatewayModel[]; maxWaitSeconds?: unknown };
  const out: ModelCatalog = { models: body.models ?? [] };
  if (typeof body.maxWaitSeconds === 'number' && Number.isFinite(body.maxWaitSeconds)) {
    out.maxWaitSeconds = body.maxWaitSeconds;
  }
  return out;
}
