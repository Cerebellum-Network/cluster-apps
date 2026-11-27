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
import { useEffect, useRef, useState } from 'react';

import type { Series } from './metricsApi';
import type { UsagePreset, UsageWindow } from './usageMath';
import { isAuthError, LIMITED, loadUsage, metricsNotConfigured, PEAK, readBars, type UsageState } from './usageReads';
import { useComputeToken, type ComputeToken } from '~/compute/useComputeToken';

/** Every failure the page shows, in user words; the raw message goes in a tooltip. */
export const USAGE_DOWN = 'The usage service isn’t responding. Try Refresh.';
export const MINT_FAILED = 'Couldn’t get access to your usage. Try Refresh to approve it in your wallet.';

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));
export type { UsageData, UsageState } from './usageReads';

// ── Token ────────────────────────────────────────────────────────────────────

export type UsageKey = ComputeToken;

/**
 * The usage token for `bucketId`: the console's COMPUTE token for the bucket
 * (compute/useComputeToken.ts), shared with Sandboxes and Agents. `onAuthError`
 * (a read got 401/403) drops it and re-mints once; `retry` (Refresh) mints again.
 */
export function useUsageKey(bucketId: string | null): { state: UsageKey; onAuthError: () => void; retry: () => void } {
  return useComputeToken(bucketId, USAGE_TOKEN_MESSAGES);
}

const USAGE_TOKEN_MESSAGES = { mintFailed: MINT_FAILED, rejected: USAGE_DOWN };

/**
 * The window's reads; a refresh keeps the last answer on screen until the new
 * one lands. The answer is tagged with the token and the preset it was read
 * with: under another token (another account or bucket) it is dropped, not
 * shown as "refreshing".
 */
export function useUsageData(key: string | null, preset: UsagePreset, reload: number, onAuthError: () => void): UsageState {
  const tag = `${key}|${preset}`;
  const [state, setState] = useState<{ tag: string; value: UsageState } | null>(null);
  const authRef = useRef(onAuthError);
  authRef.current = onAuthError;

  useEffect(() => {
    if (!key) return undefined;
    const ctl = new AbortController();
    setState((s) =>
      s && s.tag === tag && s.value.kind === 'ready'
        ? { tag, value: { ...s.value, refreshing: true } }
        : { tag, value: { kind: 'loading' } },
    );
    loadUsage(key, preset, Date.now(), ctl.signal).then(
      (data) => { if (!ctl.signal.aborted) setState({ tag, value: { kind: 'ready', data, refreshing: false } }); },
      (e: unknown) => {
        if (ctl.signal.aborted) return;
        if (isAuthError(e)) { authRef.current(); return; }
        setState({ tag, value: metricsNotConfigured(e) ? { kind: 'unavailable' } : { kind: 'error', message: USAGE_DOWN, detail: messageOf(e) } });
      },
    );
    return () => ctl.abort();
    // `tag` carries the key and the preset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag, reload]);

  if (!key || !state || state.tag !== tag) return { kind: 'loading' };
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
  // `nowMs` too: a Refresh (manual or auto) reads the opened row again, not only the page.
  const tag = `${key}|${model}|${w.fromMs}|${w.toMs}|${w.barMs}|${w.nowMs}`;
  const [state, setState] = useState<{ for: string; model: string; value: DetailState } | null>(null);
  const authRef = useRef(onAuthError);
  authRef.current = onAuthError;
  useEffect(() => {
    const ctl = new AbortController();
    // A refresh (auto or manual) keeps the last chart on screen until the new one lands.
    setState((s) => (s?.value.kind === 'ready' && s.model === model ? s : { for: tag, model, value: { kind: 'loading' } }));
    Promise.all([
      readBars(key, { ...PEAK, labels: { ...PEAK.labels, model } }, w, ctl.signal),
      readBars(key, { metric: LIMITED, groupBy: 'reason', stat: 'increase', labels: { model } }, w, ctl.signal),
    ]).then(
      ([peak, refused]) => { if (!ctl.signal.aborted) setState({ for: tag, model, value: { kind: 'ready', data: { peak, refused } } }); },
      (e: unknown) => {
        if (ctl.signal.aborted) return;
        if (isAuthError(e)) { authRef.current(); return; }
        setState({ for: tag, model, value: { kind: 'error', message: USAGE_DOWN, detail: messageOf(e) } });
      },
    );
    return () => ctl.abort();
    // `tag` carries the key, model and window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag]);
  if (state?.for === tag) return state.value;
  return state?.model === model && state.value.kind === 'ready' ? state.value : { kind: 'loading' };
}
