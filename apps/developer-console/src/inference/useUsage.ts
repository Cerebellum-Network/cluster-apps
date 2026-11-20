/**
 * Data hooks for Inference → Usage. Three reads, all scoped to one bucket's
 * short-lived COMPUTE key (minted in memory, never stored):
 *   - useReadKey   — mint the key for the chosen bucket on an explicit click;
 *   - useLiveLimits — poll /limits for the "N of N at once" grid;
 *   - useUsageBoards — range totals (requests/GPU by model, tokens, refusals).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAccount } from '~/hooks';
import {
  getLimits,
  queryRange,
  sumSeries,
  totalsByLabel,
  peakByBucket,
  seriesMax,
  withLabel,
  GatewayError,
  type BucketLimits,
  type GroupTotal,
  type Peak,
  type Series,
} from './metricsApi';

/** In memory only, for this page's reads — long enough to browse, short enough not to linger. */
const KEY_TTL_MS = 60 * 60 * 1000;
/** The limiter moves in seconds; refresh the live grid on this cadence. */
const LIVE_POLL_MS = 15_000;

export type UsageRange = '24h' | '7d' | '30d';
/** `chartBucketMs` is the "requests at once" chart's bar width: hourly for 24h, daily beyond. */
export const USAGE_RANGES: Record<UsageRange, { ms: number; step: string; stepMs: number; chartBucketMs: number }> = {
  '24h': { ms: 86_400_000, step: '15m', stepMs: 900_000, chartBucketMs: 3_600_000 },
  '7d': { ms: 7 * 86_400_000, step: '1h', stepMs: 3_600_000, chartBucketMs: 86_400_000 },
  '30d': { ms: 30 * 86_400_000, step: '6h', stepMs: 21_600_000, chartBucketMs: 86_400_000 },
};
export const RANGE_OPTIONS: UsageRange[] = ['24h', '7d', '30d'];

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));
const statusOf = (e: unknown): number | undefined => (e instanceof GatewayError ? e.status : undefined);
/** A read key that expired (or never had the scope): the caller re-mints it. */
const isAuthError = (e: unknown): boolean => e instanceof GatewayError && (e.status === 401 || e.status === 403);
/** The gateway 503s both when no metrics store is configured and when it fails; only the first is "not here yet". */
const metricsNotConfigured = (e: unknown): boolean =>
  e instanceof GatewayError && e.status === 503 && /not configured/i.test(e.message);

// ── Read key (minted in memory per bucket) ───────────────────────────────────

export type ReadKey =
  | { kind: 'idle' }
  | { kind: 'minting' }
  | { kind: 'ready'; key: string }
  | { kind: 'error'; message: string };

/**
 * Mint a COMPUTE-only read key for `bucketId`, held in state only. Minting signs
 * with the wallet, which pops a passkey when the signer is cold, so it runs on an
 * explicit `mint()` click (a user gesture) rather than on open — the page shows a
 * "Show usage" button. A bucket change resets to idle so the new bucket is a fresh
 * click. `mint` doubles as the retry.
 */
export function useReadKey(bucketId: string | null): { state: ReadKey; mint: () => void; expire: () => void } {
  const account = useAccount();
  const accountRef = useRef(account);
  accountRef.current = account;
  const [state, setState] = useState<ReadKey>({ kind: 'idle' });
  const cancelled = useRef(false);

  // A new bucket (or none) drops the held key back to idle.
  useEffect(() => {
    cancelled.current = false;
    setState({ kind: 'idle' });
    return () => { cancelled.current = true; };
  }, [bucketId]);

  const mint = useCallback(() => {
    if (!bucketId) return;
    setState({ kind: 'minting' });
    accountRef.current.createInferenceApiKey(BigInt(bucketId), KEY_TTL_MS).then(
      (key) => { if (!cancelled.current) setState({ kind: 'ready', key }); },
      (e: unknown) => { if (!cancelled.current) setState({ kind: 'error', message: messageOf(e) }); },
    );
  }, [bucketId]);

  // Drop the held key back to idle when a read rejects it (401/403): the 1-hour
  // key has expired, so the page shows "Show usage" again rather than looping on
  // a raw 401 (#191 review).
  const expire = useCallback(() => {
    setState((s) => (s.kind === 'ready' ? { kind: 'idle' } : s));
  }, []);

  return { state, mint, expire };
}

// ── Live limits (polled) ─────────────────────────────────────────────────────

export type Live =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; status?: number }
  | { kind: 'ready'; limits: BucketLimits };

/** /limits, polled while `key` is set. On 401/403 the key is expired via `onExpired`. */
export function useLiveLimits(key: string | null, onExpired: () => void): Live {
  const [state, setState] = useState<Live>({ kind: 'loading' });
  useEffect(() => {
    if (!key) return undefined;
    const ctl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      getLimits(key, ctl.signal).then(
        (limits) => {
          if (ctl.signal.aborted) return;
          setState({ kind: 'ready', limits });
          timer = setTimeout(tick, LIVE_POLL_MS);
        },
        (e: unknown) => {
          if (ctl.signal.aborted) return;
          // An expired key resets the page; don't keep polling a 401.
          if (isAuthError(e)) { onExpired(); return; }
          setState({ kind: 'error', message: messageOf(e), status: statusOf(e) });
          timer = setTimeout(tick, LIVE_POLL_MS);
        },
      );
    };
    setState({ kind: 'loading' });
    tick();
    return () => { ctl.abort(); if (timer) clearTimeout(timer); };
  }, [key, onExpired]);
  return state;
}

// ── Range boards (totals over the selected window) ───────────────────────────

export interface UsageBoards {
  totalRequests: number;
  requestsByModel: GroupTotal[];
  gpuByModel: GroupTotal[];
  refusalsByReason: GroupTotal[];
  totalRefusals: number;
  /** Peak concurrent requests per time bucket, for the "requests at once" chart. */
  peaks: Peak[];
  /** The bucket's concurrency limit (0 when the gateway doesn't report it). */
  concurrencyLimit: number;
}

export type Boards =
  | { kind: 'loading' }
  /** No VictoriaMetrics on this cluster — the board can't exist here yet. */
  | { kind: 'unavailable' }
  | { kind: 'error'; message: string; status?: number }
  | { kind: 'ready'; data: UsageBoards };

async function loadBoards(key: string, range: UsageRange, nowMs: number, signal: AbortSignal): Promise<UsageBoards> {
  const { ms, step, stepMs, chartBucketMs } = USAGE_RANGES[range];
  // End at `now`, not the last whole step boundary: a usage page should show the
  // call you just made, so the current (partial) step is included — its increase()
  // is the partial total so far. `from` is step-aligned to keep the buckets clean.
  const toMs = nowMs;
  const fromMs = Math.floor((nowMs - ms) / stepMs) * stepMs;
  const counter = (metric: Parameters<typeof queryRange>[1]['metric'], groupBy: Parameters<typeof queryRange>[1]['groupBy']) =>
    queryRange(key, { metric, groupBy, stat: 'increase', window: step }, fromMs, toMs, step, stepMs, signal);

  // Tokens (inference_gateway_usage_total) are intentionally not read: the series
  // exist per direction but under-count — ~half the tokens drop (10 of 40 across
  // two glm-5.3 calls, bucket 577182, 2026-11-19; a short-window increase() probe
  // read 0). Can't tell gateway counting from an increase() artifact — the metrics
  // API exposes only rate/increase, never the raw counter. Reliable per-token usage
  // is the gateway usage journal (D35), so Usage marks tokens "Coming soon" until then.
  // inflight is a gauge (no stat): its range values give the peak-concurrency
  // chart (state=used) against the limit (state=max). Extra, like refusals — an
  // older gateway without it still draws the rest (#191 review, board 7).
  const extra = (e: unknown): Series[] => {
    if (signal.aborted || metricsNotConfigured(e)) throw e;
    return [];
  };
  const [req, gpu, limited, inflight] = await Promise.all([
    counter('inference_gateway_requests_total', 'model'),
    counter('inference_gateway_gpu_units_total', 'model'),
    counter('inference_gateway_limited_total', 'reason').catch(extra),
    queryRange(key, { metric: 'inference_gateway_inflight', groupBy: 'state' }, fromMs, toMs, step, stepMs, signal).catch(extra),
  ]);

  const nonZero = (g: GroupTotal) => g.total > 0;
  return {
    totalRequests: sumSeries(req),
    requestsByModel: totalsByLabel(req, 'model').filter(nonZero),
    gpuByModel: totalsByLabel(gpu, 'model').filter(nonZero),
    refusalsByReason: totalsByLabel(limited, 'reason').filter(nonZero),
    totalRefusals: sumSeries(limited),
    peaks: peakByBucket(withLabel(inflight, 'state', 'used'), chartBucketMs),
    concurrencyLimit: seriesMax(withLabel(inflight, 'state', 'max')),
  };
}

export function useUsageBoards(key: string | null, range: UsageRange, reload: number, onExpired: () => void): Boards {
  const [state, setState] = useState<Boards>({ kind: 'loading' });
  useEffect(() => {
    if (!key) return undefined;
    const ctl = new AbortController();
    setState({ kind: 'loading' });
    loadBoards(key, range, Date.now(), ctl.signal).then(
      (data) => { if (!ctl.signal.aborted) setState({ kind: 'ready', data }); },
      (e: unknown) => {
        if (ctl.signal.aborted) return;
        if (isAuthError(e)) { onExpired(); return; }
        if (metricsNotConfigured(e)) setState({ kind: 'unavailable' });
        else setState({ kind: 'error', message: messageOf(e), status: statusOf(e) });
      },
    );
    return () => ctl.abort();
  }, [key, range, reload, onExpired]);
  return state;
}
