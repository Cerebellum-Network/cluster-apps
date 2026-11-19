/**
 * The Inference Gateway's per-bucket limits and usage metrics, for the Usage
 * board. Structurally ported from ROC (src/features/inferenceLimits/limitsApi.ts
 * + limitsMath.ts) — but with the metric NAMES this gateway actually serves.
 *
 * ROC's whitelist (`inference_gateway_bucket_*` / `model_inflight`) is stale and
 * 400s on the live gateway; the names below were verified against the test
 * deployment on bucket 577182 (2026-11-19). Anything off the whitelist is a 400.
 *
 * Both routes are scoped to the bucket of the COMPUTE key presented, so a key
 * only ever reads its own bucket's usage.
 */
import { inferenceConfig } from './inferenceConfig';

export class GatewayError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'GatewayError';
  }
}

/** One model's live limit + usage, as `/api/v1/limits` reports it. */
export interface ModelLimit {
  /** "bucket/name/version", e.g. "1338/glm-5.3/v1.0.0". */
  model: string;
  alias?: string;
  /** The profile's concurrency limit; 0 means no limit. */
  limit: { maxInFlight: number };
  /** The bucket's requests in flight on this model, held to the limit. */
  inFlight: number;
  /** The model's fleet-wide load (not the bucket's). */
  modelStatus?: { status: string; ceiling: number; inFlight: number };
}

export interface BucketLimits {
  bucket: number;
  /** "default" (Free: 8 in flight), "pro" (20), … — shown as-is. */
  profile: string;
  scope?: string;
  /** False when the gateway reports the limits without enforcing them. */
  enabled: boolean;
  models: ModelLimit[];
}

/**
 * The metrics the gateway serves (verified). Counters end in `_total` and want
 * stat=increase; `inflight` is a gauge. groupBy per metric:
 *   requests_total  → model (also status)
 *   usage_total     → direction (input|output); carries a `unit` axis
 *   gpu_units_total → model
 *   limited_total   → reason (rate_limited|saturated)
 *   inflight        → state (used|max)
 */
export type GatewayMetric =
  | 'inference_gateway_requests_total'
  | 'inference_gateway_usage_total'
  | 'inference_gateway_gpu_units_total'
  | 'inference_gateway_limited_total'
  | 'inference_gateway_inflight';

export type GroupBy = 'model' | 'direction' | 'reason' | 'status' | 'state' | 'unit';

export interface MetricsQuery {
  metric: GatewayMetric;
  /** A range query when set; an instant query (rate over the last 5m) otherwise. */
  range?: { from: Date; to: Date; step: string };
  groupBy?: GroupBy;
  /** Counters only. */
  stat?: 'rate' | 'increase';
  /** The increase/rate window per step (usually the step). */
  window?: string;
  labels?: Record<string, string>;
}

export interface Series {
  labels: Record<string, string>;
  /** [epoch ms, value], in time order. */
  points: Array<[number, number]>;
}

interface PromResult { metric?: Record<string, string>; value?: [number, string]; values?: Array<[number, string]> }

const point = ([t, v]: [number, string]): [number, number] => [t * 1000, Number(v)];

/** The gateway's `{data:{result:[…]}}` body → our Series[]. Pure; unit-tested. */
export function toSeries(body: unknown): Series[] {
  const result = (body as { data?: { result?: PromResult[] } } | null)?.data?.result ?? [];
  return result.map((r) => ({
    labels: r.metric ?? {},
    points: r.values ? r.values.map(point) : r.value ? [point(r.value)] : [],
  }));
}

/** "1338/glm-5.3/v1.0.0" → "glm-5.3"; leaves a bare name untouched. */
export const nameOf = (modelId: string): string => (modelId.includes('/') ? modelId.split('/')[1] ?? modelId : modelId);

/** Sum of every point across every series — a counter's total over the range. */
export function sumSeries(series: Series[]): number {
  let total = 0;
  for (const s of series) for (const [, v] of s.points) if (Number.isFinite(v)) total += v;
  return total;
}

export interface GroupTotal { group: string; total: number }

/**
 * Totals per value of one label, largest first. A series missing the label is
 * bucketed under "". Used for requests-by-model, gpu-by-model, refusals-by-reason.
 */
export function totalsByLabel(series: Series[], label: string): GroupTotal[] {
  const by = new Map<string, number>();
  for (const s of series) {
    const g = s.labels[label] ?? '';
    let sum = by.get(g) ?? 0;
    for (const [, v] of s.points) if (Number.isFinite(v)) sum += v;
    by.set(g, sum);
  }
  return [...by.entries()].map(([group, total]) => ({ group, total })).sort((a, b) => b.total - a.total);
}

/**
 * [from, to] cut into pieces spanning at most `maxMs`, each starting one step
 * after the last ended so no sample is read twice. The gateway caps a range
 * query's span (24h by default), so 24h is one query and 7d is seven.
 */
export function chunkRange(fromMs: number, toMs: number, maxMs: number, stepMs: number): Array<{ from: number; to: number }> {
  const out: Array<{ from: number; to: number }> = [];
  let from = fromMs;
  for (;;) {
    const to = Math.min(toMs, from + maxMs);
    out.push({ from, to });
    if (to >= toMs) return out;
    from = to + stepMs;
  }
}

/** Series from several chunks, joined by their labels; a repeated timestamp keeps one sample. */
export function mergeSeries(chunks: Series[][]): Series[] {
  const byLabels = new Map<string, { labels: Record<string, string>; points: Map<number, number> }>();
  for (const chunk of chunks) {
    for (const s of chunk) {
      const key = JSON.stringify(Object.entries(s.labels).sort());
      const entry = byLabels.get(key) ?? { labels: s.labels, points: new Map<number, number>() };
      for (const [t, v] of s.points) entry.points.set(t, v);
      byLabels.set(key, entry);
    }
  }
  return [...byLabels.values()].map(({ labels, points }) => ({
    labels,
    points: [...points.entries()].sort((a, b) => a[0] - b[0]),
  }));
}

// ── Transport ───────────────────────────────────────────────────────────────

const base = () => inferenceConfig.gatewayUrl.replace(/\/$/, '');

async function get(url: string, key: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { headers: { authorization: `Bearer ${key}` }, cache: 'no-store', signal });
  const text = await res.text();
  if (!res.ok) {
    let message = text.slice(0, 300);
    try {
      const body = JSON.parse(text) as { error?: string | { message?: string } };
      message = (typeof body.error === 'string' ? body.error : body.error?.message) ?? message;
    } catch {
      /* raw text */
    }
    throw new GatewayError(res.status, message || `${res.status} ${res.statusText}`);
  }
  return text ? JSON.parse(text) : null;
}

/** GET /api/v1/limits for the key's bucket. */
export async function getLimits(key: string, signal?: AbortSignal): Promise<BucketLimits> {
  const body = (await get(`${base()}/api/v1/limits`, key, signal)) as Partial<BucketLimits> | null;
  return {
    bucket: Number(body?.bucket ?? 0),
    profile: String(body?.profile ?? ''),
    scope: body?.scope,
    enabled: body?.enabled !== false,
    models: Array.isArray(body?.models) ? body.models : [],
  };
}

/** GET /api/v1/metrics — one query. Throws GatewayError (503 when no metrics store, 400 off-whitelist). */
export async function queryMetrics(key: string, q: MetricsQuery, signal?: AbortSignal): Promise<Series[]> {
  const params = new URLSearchParams({ metric: q.metric });
  if (q.range) {
    params.set('from', q.range.from.toISOString().replace(/\.\d{3}Z$/, 'Z'));
    params.set('to', q.range.to.toISOString().replace(/\.\d{3}Z$/, 'Z'));
    params.set('step', q.range.step);
  }
  if (q.groupBy) params.set('groupBy', q.groupBy);
  if (q.stat) params.set('stat', q.stat);
  if (q.window) params.set('window', q.window);
  for (const [k, v] of Object.entries(q.labels ?? {})) params.set(k, v);
  return toSeries(await get(`${base()}/api/v1/metrics?${params}`, key, signal));
}

/** The gateway's default cap on a range query's span (INFERENCE_GATEWAY_METRICS_MAX_WINDOW). */
export const RANGE_QUERY_MAX_MS = 86_400_000;

/**
 * A counter's total over [fromMs, toMs]: the range split under the gateway's
 * span cap, each chunk summed as step increases, merged back together.
 */
export async function queryRange(
  key: string,
  q: Omit<MetricsQuery, 'range'>,
  fromMs: number,
  toMs: number,
  step: string,
  stepMs: number,
  signal?: AbortSignal,
): Promise<Series[]> {
  const chunks = chunkRange(fromMs, toMs, RANGE_QUERY_MAX_MS, stepMs);
  const parts = await Promise.all(
    chunks.map((c) => queryMetrics(key, { ...q, range: { from: new Date(c.from), to: new Date(c.to), step } }, signal)),
  );
  return mergeSeries(parts);
}
