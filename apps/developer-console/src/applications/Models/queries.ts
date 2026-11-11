/**
 * Local-state data hooks for the Models page.
 *
 * ROC's Models page (the port source) uses @tanstack/react-query. The revived
 * Developer Console has no react-query, so rather than pull that dependency in we
 * reproduce the small slice of its hook surface the page actually reads
 * (`data / isLoading / isError / error / status / refetch` for queries;
 * `mutate / isPending / data / error / status` for mutations). Behaviour matches
 * react-query v5: queries fetch on mount and when their deps/`enabled` change,
 * `mutate(vars, { onSuccess, onError })` fires the callbacks.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CefSigner } from '@cef-ai/wallet';
import { mintInferenceApiKey } from '~/models/apiKey';
import {
  getLimits,
  getModelManifest,
  listModelCatalog,
  runInference,
  type InferenceModelRef,
} from '~/models/inferenceGatewayApi';

type QueryStatus = 'pending' | 'success' | 'error';
interface QueryResult<T> {
  data?: T;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  status: QueryStatus;
  refetch: () => void;
}

function useQueryShim<T>(fn: () => Promise<T>, deps: unknown[], enabled = true): QueryResult<T> {
  const [state, setState] = useState<{ data?: T; isLoading: boolean; isError: boolean; error?: unknown; status: QueryStatus }>({
    isLoading: enabled,
    isError: false,
    status: 'pending',
  });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);

  const run = useCallback(() => {
    if (!enabled) {
      setState({ isLoading: false, isError: false, status: 'pending' });
      return;
    }
    const mine = ++seq.current;
    setState((prev) => ({ ...prev, isLoading: true, isError: false }));
    fnRef.current().then(
      (data) => {
        if (mine === seq.current) setState({ data, isLoading: false, isError: false, status: 'success' });
      },
      (error) => {
        if (mine === seq.current) setState({ isLoading: false, isError: true, error, status: 'error' });
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    run();
  }, [run]);

  return { ...state, refetch: run };
}

type MutationStatus = 'idle' | 'pending' | 'success' | 'error';
interface MutationResult<V, R> {
  mutate: (vars: V, opts?: { onSuccess?: (data: R) => void; onError?: (error: unknown) => void }) => void;
  data?: R;
  error?: unknown;
  isPending: boolean;
  isError: boolean;
  status: MutationStatus;
}

function useMutationShim<V, R>(fn: (vars: V) => Promise<R>): MutationResult<V, R> {
  const [state, setState] = useState<{ data?: R; error?: unknown; isPending: boolean; status: MutationStatus }>({
    isPending: false,
    status: 'idle',
  });
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const mutate = useCallback<MutationResult<V, R>['mutate']>((vars, opts) => {
    setState({ isPending: true, status: 'pending' });
    fnRef.current(vars).then(
      (data) => {
        setState({ data, isPending: false, status: 'success' });
        opts?.onSuccess?.(data);
      },
      (error) => {
        setState({ error, isPending: false, status: 'error' });
        opts?.onError?.(error);
      },
    );
  }, []);

  return { mutate, ...state, isError: state.status === 'error' };
}

/** The inference gateway's model catalog. Public GET -- no wallet needed. */
export const useModelCatalog = () => useQueryShim(listModelCatalog, []);

/** One model version's CDN manifest; fetched lazily (e.g. when a card expands). */
export const useModelManifest = (bucket: number, name: string, version: string, enabled: boolean) =>
  useQueryShim(() => getModelManifest(bucket, name, version), [bucket, name, version], enabled);

/** The bucket's usage + limits for an API key. */
export const useLimits = (apiKey: string) => useQueryShim(() => getLimits(apiKey), [apiKey], !!apiKey);

/**
 * Mint an inference API key for a numeric bucket id. The key is shown once and
 * cannot be revoked (stateless), so callers surface a short TTL + warning.
 */
export const useMintApiKey = (getSigner: () => CefSigner) =>
  useMutationShim(({ bucketId, ttlMs }: { bucketId: bigint; ttlMs: number }) =>
    mintInferenceApiKey(getSigner, bucketId, ttlMs),
  );

/** Run one inference request (playground, non-streaming path). */
export const useRunInference = () =>
  useMutationShim(({ model, inputs, apiKey }: { model: InferenceModelRef; inputs: unknown; apiKey?: string }) =>
    runInference(model, inputs, apiKey),
  );
