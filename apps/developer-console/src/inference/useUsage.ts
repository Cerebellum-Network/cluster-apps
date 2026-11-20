/**
 * Data hooks for Inference → Usage, all read with one bucket-scoped COMPUTE
 * token:
 *   - useUsageKey   — the token: cached per (account, bucket), minted on mount
 *                     when none is cached (the wallet shows its own consent),
 *                     re-minted once when the gateway rejects it;
 *   - useUsageData  — the window's totals, previous-period totals and charts;
 *   - useModelDetail — an opened row's in-flight peaks and refusals per bar.
 * The arithmetic is in usageMath.ts.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAccount } from '~/hooks';
import { GatewayError, getLimits, nameOf, queryMetrics, queryRange, type MetricsQuery, type Series } from './metricsApi';
import { byLabel, stepString, usageWindow, type InstantReads, type UsagePreset, type UsageWindow } from './usageMath';
import { dropUsageToken, readUsageToken, writeUsageToken, USAGE_TOKEN_TTL_MS } from './usageToken';

/** Every failure the page shows, in user words; the raw message goes in a tooltip. */
export const USAGE_DOWN = 'The usage service isn’t responding. Try Refresh.';
export const MINT_FAILED = 'Couldn’t get access to your usage. Try Refresh to approve it in your wallet.';

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));
/** The token expired or was refused: drop it and mint a new one. */
export const isAuthError = (e: unknown): boolean => e instanceof GatewayError && (e.status === 401 || e.status === 403);
/** The gateway 503s both when no metrics store is configured and when it fails; only the first is "not here yet". */
const metricsNotConfigured = (e: unknown): boolean => e instanceof GatewayError && e.status === 503 && /not configured/i.test(e.message);

// ── Token ────────────────────────────────────────────────────────────────────

export type UsageKey =
  | { kind: 'minting' }
  | { kind: 'ready'; key: string }
  | { kind: 'error'; message: string; detail: string };

/**
 * One mint per (account, bucket) at a time across the app, so React's
 * double-run effects (and a quick remount) never pop the wallet twice.
 */
const inFlight = new Map<string, Promise<string>>();

/** A token rejected within this long of its mint is not re-minted again: one automatic re-mint, then an error. */
const FRESH_MS = 10 * 60 * 1000;

/**
 * The usage token for `bucketId`: the cached one, or a fresh one minted on
 * mount. `onAuthError` (a read got 401/403) drops it and re-mints once; a
 * freshly minted token rejected again is an error, not a loop of wallet prompts. `retry` (Refresh) mints again.
 */
export function useUsageKey(bucketId: string | null): { state: UsageKey; onAuthError: () => void; retry: () => void } {
  const account = useAccount();
  const accountRef = useRef(account);
  accountRef.current = account;
  const owner = account.account;
  const [state, setState] = useState<UsageKey>({ kind: 'minting' });
  const [attempt, setAttempt] = useState(0);
  /** When this hook last minted: a token rejected soon after is not stale, the gateway is refusing it. */
  const mintedAt = useRef(0);

  useEffect(() => {
    if (!bucketId) return undefined;
    let dead = false;
    const cached = readUsageToken(owner, bucketId);
    if (cached) {
      setState({ kind: 'ready', key: cached });
      return undefined;
    }
    setState({ kind: 'minting' });
    const id = `${owner}:${bucketId}`;
    let mint = inFlight.get(id);
    if (!mint) {
      const expiresAt = Date.now() + USAGE_TOKEN_TTL_MS;
      mintedAt.current = Date.now();
      mint = accountRef.current.createInferenceApiKey(BigInt(bucketId), USAGE_TOKEN_TTL_MS).then((token) => {
        writeUsageToken(owner, bucketId, token, expiresAt);
        return token;
      });
      inFlight.set(id, mint);
      const clear = () => inFlight.delete(id);
      mint.then(clear, clear);
    }
    mint.then(
      (key) => { if (!dead) setState({ kind: 'ready', key }); },
      (e: unknown) => { if (!dead) setState({ kind: 'error', message: MINT_FAILED, detail: messageOf(e) }); },
    );
    return () => { dead = true; };
  }, [owner, bucketId, attempt]);

  const onAuthError = useCallback(() => {
    if (!bucketId) return;
    dropUsageToken(owner, bucketId);
    if (Date.now() - mintedAt.current < FRESH_MS) {
      setState({ kind: 'error', message: USAGE_DOWN, detail: 'The gateway rejected a freshly minted token.' });
      return;
    }
    setAttempt((n) => n + 1);
  }, [owner, bucketId]);

  const retry = useCallback(() => {
    mintedAt.current = 0;
    setAttempt((n) => n + 1);
  }, []);

  return { state, onAuthError, retry };
}

// ── The window's reads ───────────────────────────────────────────────────────

const USAGE = 'inference_gateway_usage_total';
const GPU = 'inference_gateway_gpu_units_total';
const REQUESTS = 'inference_gateway_requests_total';
const INFLIGHT = 'inference_gateway_inflight';
const LIMITED = 'inference_gateway_limited_total';

type Read = Pick<MetricsQuery, 'metric' | 'labels' | 'stat'>;

/** The in-flight peak: max_over_time of requests in flight (not the limit). */
const PEAK: Read = { metric: INFLIGHT, stat: 'max', labels: { state: 'used' } };

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
 * - instant reads at the window's end over the whole span: GPU units,
 *   requests, tokens in / cached / out, the in-flight peak, the limit, and
 *   429s by reason;
 * - the same at the window's start for the previous period: GPU units,
 *   requests, 429s, the peak;
 * - range reads per bar for the two charts;
 * - /limits, for a limit the metrics don't carry.
 */
export async function loadUsage(key: string, preset: UsagePreset, nowMs: number, signal: AbortSignal): Promise<UsageData> {
  const w = usageWindow(preset, nowMs);
  const span = stepString(w.toMs - w.fromMs);
  const bar = stepString(w.barMs);
  const instant = (at: number, q: Read) =>
    queryMetrics(key, { ...q, stat: q.stat ?? 'increase', groupBy: 'model', window: span, at: new Date(at) }, signal).then((s) => byLabel(s));
  const now = (q: Read) => instant(w.toMs, q);
  const before = (q: Read) => instant(w.fromMs, q);
  const steps = (metric: Read['metric']) =>
    queryRange(key, { metric, groupBy: 'model', stat: 'increase', window: bar }, w.fromMs, w.toMs, bar, w.barMs, signal);

  // Token counts are optional: a gateway without them still draws the rest.
  let tokensAvailable = true;
  const optional = (e: unknown): Map<string, number> => {
    if (signal.aborted || isAuthError(e) || metricsNotConfigured(e)) throw e;
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

/** The window's reads; a refresh keeps the last answer on screen until the new one lands. */
export function useUsageData(key: string | null, preset: UsagePreset, reload: number, onAuthError: () => void): UsageState {
  const [state, setState] = useState<{ preset: UsagePreset; value: UsageState } | null>(null);
  const authRef = useRef(onAuthError);
  authRef.current = onAuthError;

  useEffect(() => {
    if (!key) return undefined;
    const ctl = new AbortController();
    setState((s) =>
      s && s.preset === preset && s.value.kind === 'ready'
        ? { preset, value: { ...s.value, refreshing: true } }
        : { preset, value: { kind: 'loading' } },
    );
    loadUsage(key, preset, Date.now(), ctl.signal).then(
      (data) => { if (!ctl.signal.aborted) setState({ preset, value: { kind: 'ready', data, refreshing: false } }); },
      (e: unknown) => {
        if (ctl.signal.aborted) return;
        if (isAuthError(e)) { authRef.current(); return; }
        setState({ preset, value: metricsNotConfigured(e) ? { kind: 'unavailable' } : { kind: 'error', message: USAGE_DOWN, detail: messageOf(e) } });
      },
    );
    return () => ctl.abort();
  }, [key, preset, reload]);

  if (!key || !state || state.preset !== preset) return { kind: 'loading' };
  return state.value;
}

// ── An opened row ────────────────────────────────────────────────────────────

export interface ModelDetail {
  /** max_over_time of in flight per bar. */
  peak: Series[];
  /** 429s per bar, `sum by (reason)`. */
  refused: Series[];
}

export type DetailState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; detail: string }
  | { kind: 'ready'; data: ModelDetail };

/** One opened row's two range reads, filtered to the model. */
export function useModelDetail(key: string, model: string, w: UsageWindow, onAuthError: () => void): DetailState {
  const tag = `${key}|${model}|${w.fromMs}|${w.toMs}|${w.barMs}`;
  const [state, setState] = useState<{ for: string; value: DetailState } | null>(null);
  const authRef = useRef(onAuthError);
  authRef.current = onAuthError;
  useEffect(() => {
    const ctl = new AbortController();
    const bar = stepString(w.barMs);
    setState({ for: tag, value: { kind: 'loading' } });
    Promise.all([
      queryRange(key, { ...PEAK, window: bar, labels: { ...PEAK.labels, model } }, w.fromMs, w.toMs, bar, w.barMs, ctl.signal),
      queryRange(key, { metric: LIMITED, groupBy: 'reason', stat: 'increase', window: bar, labels: { model } }, w.fromMs, w.toMs, bar, w.barMs, ctl.signal),
    ]).then(
      ([peak, refused]) => { if (!ctl.signal.aborted) setState({ for: tag, value: { kind: 'ready', data: { peak, refused } } }); },
      (e: unknown) => {
        if (ctl.signal.aborted) return;
        if (isAuthError(e)) { authRef.current(); return; }
        setState({ for: tag, value: { kind: 'error', message: USAGE_DOWN, detail: messageOf(e) } });
      },
    );
    return () => ctl.abort();
    // `tag` carries the key, model and window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag]);
  return state?.for === tag ? state.value : { kind: 'loading' };
}
