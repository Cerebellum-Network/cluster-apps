/**
 * The Usage page's gateway reads, apart from React and the wallet so they are
 * tested on their own. Sampling is described in usageMath.ts.
 */
import { GatewayError, getLimits, mergeSeries, nameOf, queryMetrics, queryRange, type MetricsQuery, type Series } from './metricsApi';
import { byLabel, secondsWindow, stepString, usageWindow, type InstantReads, type UsagePreset, type UsageWindow } from './usageMath';

/** The token expired or was refused: drop it and mint a new one. */
export const isAuthError = (e: unknown): boolean => e instanceof GatewayError && (e.status === 401 || e.status === 403);
/** The gateway 503s both when no metrics store is configured and when it fails; only the first is "not here yet". */
export const metricsNotConfigured = (e: unknown): boolean => e instanceof GatewayError && e.status === 503 && /not configured/i.test(e.message);
/**
 * The gateway refused a token read as a bad request: the metric or one of its
 * labels isn't on its allow-list (an older gateway). Only that hides the token
 * counts; a 5xx or a network error fails the page like any other read.
 */
export const tokensNotServed = (e: unknown): boolean => e instanceof GatewayError && e.status === 400;

const USAGE = 'inference_gateway_usage_total';
const GPU = 'inference_gateway_gpu_units_total';
const REQUESTS = 'inference_gateway_requests_total';
const INFLIGHT = 'inference_gateway_inflight';
export const LIMITED = 'inference_gateway_limited_total';

type Read = Pick<MetricsQuery, 'metric' | 'labels' | 'stat'>;
type BarRead = Omit<MetricsQuery, 'range' | 'at' | 'window'>;

/**
 * Per-bar reads over the window: a range read of `stat(metric[bar])` at each
 * whole bar end, and — when now falls inside a bar — one instant read of the
 * partial bar up to now, placed at that bar's end. The two are joined by labels.
 */
export async function readBars(key: string, q: BarRead, w: UsageWindow, signal: AbortSignal): Promise<Series[]> {
  const bar = stepString(w.barMs);
  const whole = w.wholeToMs > w.fromMs
    ? queryRange(key, { ...q, window: bar }, w.fromMs, w.wholeToMs, bar, w.barMs, signal)
    : Promise.resolve<Series[]>([]);
  const partial = w.nowMs > w.wholeToMs
    ? queryMetrics(key, { ...q, window: secondsWindow(w.nowMs - w.wholeToMs), at: new Date(w.nowMs) }, signal)
    : Promise.resolve<Series[]>([]);
  const [a, b] = await Promise.all([whole, partial]);
  const at = (s: Series): Series => ({ labels: s.labels, points: s.points.length ? [[w.toMs, s.points[s.points.length - 1][1]]] : [] });
  return mergeSeries([a, b.map(at)]);
}

/** The in-flight peak: max_over_time of requests in flight (not the limit). */
export const PEAK: Read = { metric: INFLIGHT, stat: 'max', labels: { state: 'used' } };

export interface UsageData {
  window: UsageWindow;
  reads: InstantReads;
  /** Limits from /limits by bare model name, for models whose metrics carry none. */
  fallbackLimits: Map<string, number>;
  /** False when the gateway wouldn't serve token counts (an older gateway). */
  tokensAvailable: boolean;
  /** `sum by (model)` increase per bar. */
  gpuSteps: Series[];
  requestSteps: Series[];
}

export type UsageState =
  | { kind: 'loading' }
  /** No metrics store on this cluster. */
  | { kind: 'unavailable' }
  | { kind: 'error'; message: string; detail: string }
  /** `refreshing`: a re-read is in flight while this answer stays on screen. */
  | { kind: 'ready'; data: UsageData; refreshing: boolean };

/**
 * The page's reads for one window, all `sum by (model)`:
 * - instant reads at now over the whole window: GPU units,
 *   requests, tokens in / cached / out, the in-flight peak, the limit, and
 *   429s by reason;
 * - the same at the window's start for the previous period: GPU units,
 *   requests, 429s, the peak;
 * - range reads per bar for the two charts;
 * - /limits, for a limit the metrics don't carry.
 */
export async function loadUsage(key: string, preset: UsagePreset, nowMs: number, signal: AbortSignal): Promise<UsageData> {
  const w = usageWindow(preset, nowMs);
  // The whole window, now included: a call made a minute ago counts.
  const span = secondsWindow(w.nowMs - w.fromMs);
  const instant = (at: number, q: Read) =>
    queryMetrics(key, { ...q, stat: q.stat ?? 'increase', groupBy: 'model', window: span, at: new Date(at) }, signal).then((s) => byLabel(s));
  const now = (q: Read) => instant(w.nowMs, q);
  const before = (q: Read) => instant(w.fromMs, q);
  const steps = (metric: Read['metric']) => readBars(key, { metric, groupBy: 'model', stat: 'increase' }, w, signal);

  // Token counts are optional: a gateway that doesn't serve them still draws the rest.
  let tokensAvailable = true;
  const optional = (e: unknown): Map<string, number> => {
    if (signal.aborted || !tokensNotServed(e)) throw e;
    tokensAvailable = false;
    return new Map();
  };
  const tokens = (direction: string) => now({ metric: USAGE, labels: { unit: 'token', direction } }).catch(optional);

  const [
    gpu, requests, tokensIn, tokensCached, tokensOut, peak, limits, refusedLimit, refusedFull,
    prevGpu, prevRequests, prevRefused, prevPeak,
    gpuSteps, requestSteps, live,
  ] = await Promise.all([
    now({ metric: GPU }),
    now({ metric: REQUESTS }),
    tokens('input'),
    tokens('cached'),
    tokens('output'),
    now(PEAK),
    now({ metric: INFLIGHT, stat: 'max', labels: { state: 'max' } }),
    now({ metric: LIMITED, labels: { reason: 'rate_limited' } }),
    now({ metric: LIMITED, labels: { reason: 'saturated' } }),
    before({ metric: GPU }),
    before({ metric: REQUESTS }),
    before({ metric: LIMITED }),
    before(PEAK),
    steps(GPU),
    steps(REQUESTS),
    getLimits(key, signal).catch((e: unknown) => {
      if (signal.aborted || isAuthError(e)) throw e;
      return null;
    }),
  ]);

  const fallbackLimits = new Map<string, number>();
  for (const m of live?.models ?? []) {
    if (m.limit.maxInFlight > 0) {
      fallbackLimits.set(nameOf(m.model), m.limit.maxInFlight);
      if (m.alias) fallbackLimits.set(m.alias, m.limit.maxInFlight);
    }
  }

  return {
    window: w,
    reads: {
      gpu, requests, tokensIn, tokensCached, tokensOut, peak, limits, refusedLimit, refusedFull,
      prev: { gpu: prevGpu, requests: prevRequests, refused: prevRefused, peak: prevPeak },
    },
    fallbackLimits,
    tokensAvailable,
    gpuSteps,
    requestSteps,
  };
}

