/**
 * Read hooks for the Sandboxes and Agents pages. Each polls the compute
 * gateway with the page's client while the tab is visible, keeps the last good
 * answer on screen through a failed poll, and hands a 401 to the provider so
 * the token is re-minted.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  collect,
  errorMessage,
  isTokenRejected,
  type ComputeClient,
  type EgressLogQuery,
  type ListSandboxesQuery,
  type UsageRecordsQuery,
} from './client';
import { useCompute } from './ComputeProvider';
import type { EgressEntry, Sandbox, SecretSummary, UsageRecord } from './types';

export type Polled<T> = {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  /** When the data on screen was read. */
  at: number | null;
  reload: () => void;
};

const visible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';

/**
 * Call `fn` with the client now and every `intervalMs` (null: once). `key`
 * restarts it with fresh state (e.g. another sandbox id or filter).
 */
export function usePolled<T>(
  fn: (client: ComputeClient, signal: AbortSignal) => Promise<T>,
  key: string,
  intervalMs: number | null,
): Polled<T> {
  const { client, onAuthError } = useCompute();
  const [state, setState] = useState<{
    key: string;
    data?: T;
    error: string | null;
    loading: boolean;
    at: number | null;
  }>({
    key,
    error: null,
    loading: true,
    at: null,
  });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const authRef = useRef(onAuthError);
  authRef.current = onAuthError;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!client) return undefined;
    let alive = true;
    let ctl: AbortController | null = null;
    setState((s) => (s.key === key ? { ...s, loading: true } : { key, error: null, loading: true, at: null }));
    const run = () => {
      if (!visible() && ctl) return; // first read always; later ones wait for the tab
      ctl?.abort();
      const mine = new AbortController();
      ctl = mine;
      fnRef
        .current(client, mine.signal)
        .then((data) => {
          if (alive && !mine.signal.aborted) setState({ key, data, error: null, loading: false, at: Date.now() });
        })
        .catch((e: unknown) => {
          if (!alive || mine.signal.aborted) return;
          if (isTokenRejected(e)) authRef.current();
          setState((s) => ({ ...s, key, error: errorMessage(e), loading: false }));
        });
    };
    run();
    const t = intervalMs ? window.setInterval(run, intervalMs) : undefined;
    return () => {
      alive = false;
      ctl?.abort();
      if (t) window.clearInterval(t);
    };
  }, [client, key, intervalMs, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  const cur = state.key === key ? state : { data: undefined, error: null, loading: true, at: null };
  return { data: cur.data, error: cur.error, loading: cur.loading, at: cur.at, reload };
}

export const POLL = { list: 5000, detail: 3000, egress: 5000, records: 15000 } as const;

/** Up to this many sandboxes are listed (newest first). */
export const LIST_MAX = 500;

export function useSandboxes(
  q: Omit<ListSandboxesQuery, 'cursor' | 'limit'> = {},
): Polled<{ items: Sandbox[]; truncated: boolean }> {
  const key = `sandboxes:${q.status ?? ''}:${(q.label ?? []).join(',')}`;
  return usePolled(
    (c, signal) => collect((cursor) => c.listSandboxes({ ...q, limit: 100, cursor }, signal), LIST_MAX),
    key,
    POLL.list,
  );
}

/** One sandbox; polls while it is live, stops once it ends. */
export function useSandbox(id: string | undefined): Polled<Sandbox> {
  const [ended, setEnded] = useState(false);
  const polled = usePolled(
    (c, signal) => (id ? c.getSandbox(id, signal) : Promise.reject(new Error('no sandbox id'))),
    `sandbox:${id}`,
    ended ? null : POLL.detail,
  );
  const status = polled.data?.status;
  useEffect(() => {
    setEnded(status === 'terminated' || status === 'failed');
  }, [status]);
  return polled;
}

export function useSecrets(): Polled<SecretSummary[]> {
  return usePolled((c, signal) => c.listSecrets(signal), 'secrets', null);
}

/** `enabled: false` reads nothing (e.g. a run whose sandbox doesn't exist yet), rather than the whole bucket's log. */
export function useEgressLog(
  q: Omit<EgressLogQuery, 'cursor' | 'limit'> = {},
  { max = 500, enabled = true }: { max?: number; enabled?: boolean } = {},
): Polled<{ items: EgressEntry[]; truncated: boolean }> {
  const key = `egress:${enabled}:${q.sandbox_id ?? ''}:${q.decision ?? ''}:${q.since ?? ''}`;
  return usePolled(
    (c, signal) =>
      enabled
        ? collect((cursor) => c.egressLog({ ...q, limit: 200, cursor }, signal), max)
        : Promise.resolve({ items: [], truncated: false }),
    key,
    enabled ? POLL.egress : null,
  );
}

/** `intervalMs`: how often to read again (a sandbox that just ended polls faster until its final record is in). */
export function useUsageRecords(
  q: Omit<UsageRecordsQuery, 'cursor' | 'limit'> = {},
  max = 2000,
  intervalMs: number = POLL.records,
): Polled<{ items: UsageRecord[]; truncated: boolean }> {
  const key = `records:${q.sandbox_id ?? ''}:${q.since ?? ''}`;
  return usePolled(
    (c, signal) => collect((cursor) => c.usageRecords({ ...q, limit: 500, cursor }, signal), max),
    key,
    intervalMs,
  );
}

/** Re-render every `ms` so ages and timers move between polls. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}
