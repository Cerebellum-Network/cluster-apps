import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, type Params } from '~/api/client';
import { useSession } from '~/session/SessionProvider';

export interface View<T> {
  data: T | null;
  error: ApiError | Error | null;
  loading: boolean;
  updatedAt: Date | null;
  refresh: () => void;
}

/**
 * Reads one named view from the console backend, and again every `everyMs`
 * (0 = only on demand). Keeps the last good data while a refresh runs; a 401
 * ends the session.
 */
export function useView<T>(path: string, params?: Params, everyMs = 30_000): View<T> {
  const { api } = useSession();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);
  const key = path + JSON.stringify(params ?? {});
  const keyRef = useRef(key);

  useEffect(() => {
    if (keyRef.current !== key) {
      keyRef.current = key;
      setData(null);
    }
    const ctl = new AbortController();
    setLoading(true);
    api
      .get<T>(path, params, ctl.signal)
      .then((d) => {
        setData(d);
        setError(null);
        setUpdatedAt(new Date());
      })
      .catch((e: unknown) => {
        if (ctl.signal.aborted) return;
        if (e instanceof ApiError && e.isUnauthorized) {
          window.dispatchEvent(new Event('cluster-console:session-expired'));
        }
        setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => !ctl.signal.aborted && setLoading(false));
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, key, tick]);

  useEffect(() => {
    if (!everyMs) return;
    const t = setInterval(() => setTick((n) => n + 1), everyMs);
    return () => clearInterval(t);
  }, [everyMs, key]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);
  return { data, error, loading, updatedAt, refresh };
}
