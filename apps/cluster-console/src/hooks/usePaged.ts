import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, type Params } from '~/api/client';
import type { Page } from '~/api/types';
import { useSession } from '~/session/SessionProvider';

export interface Paged<T> {
  items: T[];
  cursor: string | null;
  error: ApiError | Error | null;
  loading: boolean;
  loaded: boolean;
  updatedAt: Date | null;
  loadMore: () => void;
  refresh: () => void;
}

/**
 * A cursor-paged list (DESIGN 3.1). The first page is read again every
 * `everyMs` while only one page is shown; once more pages are loaded the list
 * stays put until Refresh.
 */
export function usePaged<T>(path: string, params: Params, everyMs = 15_000): Paged<T> {
  const { api } = useSession();
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [pages, setPages] = useState(0);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);
  const key = path + JSON.stringify(params);
  const gen = useRef(0);

  const fail = (e: unknown) => {
    if (e instanceof ApiError && e.isUnauthorized) window.dispatchEvent(new Event('cluster-console:session-expired'));
    setError(e instanceof Error ? e : new Error(String(e)));
  };

  useEffect(() => {
    const my = ++gen.current;
    setLoading(true);
    api
      .get<Page<T>>(path, params)
      .then((p) => {
        if (my !== gen.current) return;
        setItems(p.items ?? []);
        setCursor(p.next_cursor ?? null);
        setPages(1);
        setError(null);
        setUpdatedAt(new Date());
      })
      .catch((e) => my === gen.current && fail(e))
      .finally(() => my === gen.current && setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, key, tick]);

  useEffect(() => {
    if (!everyMs || pages > 1) return;
    const t = setInterval(() => setTick((n) => n + 1), everyMs);
    return () => clearInterval(t);
  }, [everyMs, pages, key]);

  const loadMore = useCallback(() => {
    if (!cursor) return;
    const my = gen.current;
    setLoading(true);
    api
      .get<Page<T>>(path, { ...params, cursor })
      .then((p) => {
        if (my !== gen.current) return;
        setItems((prev) => [...prev, ...(p.items ?? [])]);
        setCursor(p.next_cursor ?? null);
        setPages((n) => n + 1);
      })
      .catch((e) => my === gen.current && fail(e))
      .finally(() => my === gen.current && setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, cursor, key]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);
  return { items, cursor, error, loading, loaded: updatedAt !== null, updatedAt, loadMore, refresh };
}
