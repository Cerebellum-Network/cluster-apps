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
import type { Series } from './metricsApi';
import type { UsagePreset, UsageWindow } from './usageMath';
import { isAuthError, LIMITED, loadUsage, metricsNotConfigured, PEAK, readBars, type UsageState } from './usageReads';
import { dropUsageToken, readUsageToken, writeUsageToken, USAGE_TOKEN_TTL_MS } from './usageToken';

/** Every failure the page shows, in user words; the raw message goes in a tooltip. */
export const USAGE_DOWN = 'The usage service isn’t responding. Try Refresh.';
export const MINT_FAILED = 'Couldn’t get access to your usage. Try Refresh to approve it in your wallet.';

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));
export type { UsageData, UsageState } from './usageReads';

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
  /** Which (account, bucket) the state is for: another's token is never handed out, not even for one render. */
  const source = `${owner}:${bucketId}`;
  const [tagged, setTagged] = useState<{ for: string; value: UsageKey }>({ for: source, value: { kind: 'minting' } });
  const setState = useCallback((value: UsageKey) => setTagged({ for: source, value }), [source]);
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
  }, [owner, bucketId, attempt, setState]);

  const onAuthError = useCallback(() => {
    if (!bucketId) return;
    dropUsageToken(owner, bucketId);
    if (Date.now() - mintedAt.current < FRESH_MS) {
      setState({ kind: 'error', message: USAGE_DOWN, detail: 'The gateway rejected a freshly minted token.' });
      return;
    }
    setAttempt((n) => n + 1);
  }, [owner, bucketId, setState]);

  const retry = useCallback(() => {
    mintedAt.current = 0;
    setAttempt((n) => n + 1);
  }, []);

  const state: UsageKey = tagged.for === source ? tagged.value : { kind: 'minting' };
  return { state, onAuthError, retry };
}

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
  const tag = `${key}|${model}|${w.fromMs}|${w.toMs}|${w.barMs}`;
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
