/**
 * The Inference Gateway's per-bucket limits and usage metrics, for the Usage
 * page. Ported from ROC (src/features/inferenceLimits/limitsApi.ts +
 * limitsMath.ts). The metric names match the gateway's whitelist
 * (ddc-node cluster/inference-gateway/metrics/query.go); anything off it is a 400.
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
 * The metrics the gateway serves. Counters end in `_total` and take
 * stat=rate|increase; `inflight` is a gauge that takes stat=max, which the
 * gateway turns into `max_over_time(inflight[window])` — the peak over every
 * scraped sample, not only the ones a step lands on. Labels per metric:
 *   requests_total  → model, status_class, caller
 *   usage_total     → model, unit (token|second|image), direction (input|output|cached), caller
 *   gpu_units_total → model, caller
 *   limited_total   → model, reason (rate_limited = your limit | saturated = model full)
 *   inflight        → model, state (used | max = the configured limit)
 */
export type GatewayMetric =
  | 'inference_gateway_requests_total'
  | 'inference_gateway_usage_total'
  | 'inference_gateway_gpu_units_total'
  | 'inference_gateway_limited_total'
  | 'inference_gateway_inflight';

export type GroupBy = 'model' | 'direction' | 'reason' | 'status_class' | 'state' | 'unit' | 'caller';

export interface MetricsQuery {
  metric: GatewayMetric;
  /** A range query when set; an instant query otherwise. */
  range?: { from: Date; to: Date; step: string };
  /** An instant query's evaluation time; now when unset. Ignored with `range`. */
  at?: Date;
  groupBy?: GroupBy;
  /** `rate`/`increase` on counters; `max` (the peak over `window`) on the inflight gauge. */
  stat?: 'rate' | 'increase' | 'max';
  /** The stat's lookback: the step for a range query, the whole span for a total. */
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
  } else if (q.at) {
    params.set('to', q.at.toISOString().replace(/\.\d{3}Z$/, 'Z'));
  }
  if (q.groupBy) params.set('groupBy', q.groupBy);
  if (q.stat) params.set('stat', q.stat);
  if (q.window) params.set('window', q.window);
  for (const [k, v] of Object.entries(q.labels ?? {})) params.set(k, v);
  return toSeries(await get(`${base()}/api/v1/metrics?${params}`, key, signal));
}

/**
 * The span one range query may cover. Older gateways cap it at 24h
 * (INFERENCE_GATEWAY_METRICS_MAX_WINDOW); reading in 24h chunks works on both.
 */
export const RANGE_QUERY_MAX_MS = 86_400_000;
/** Chunks read at once, so a 30-day range doesn't fire thirty requests together. */
const RANGE_QUERY_PARALLEL = 4;

/** `run` over `items`, at most `limit` at a time; the first failure rejects. */
export async function mapLimited<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < items.length) {
      const i = next++;
      try {
        out[i] = await run(items[i]);
      } catch (e) {
        failed = true;
        throw e;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return out;
}

/** A range query split under the span cap, the chunks joined back by labels. */
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
  const parts = await mapLimited(chunks, RANGE_QUERY_PARALLEL, (c) =>
    queryMetrics(key, { ...q, range: { from: new Date(c.from), to: new Date(c.to), step } }, signal),
  );
  return mergeSeries(parts);
}
