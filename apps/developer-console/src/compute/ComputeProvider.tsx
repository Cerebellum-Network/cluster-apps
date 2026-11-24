/**
 * Who the Sandboxes and Agents pages call the compute gateway as: the signed-in
 * wallet's first on-chain bucket (the same one Inference bills to) and the
 * console's COMPUTE token for it. Pages read it with `useCompute()`.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { useOwnerBuckets } from '~/inference/useInference';
import { createComputeClient, type ComputeClient } from './client';
import { computeConfig } from './computeConfig';
import { useComputeToken } from './useComputeToken';

export type ComputeStatus = 'buckets-loading' | 'buckets-error' | 'no-bucket' | 'minting' | 'token-error' | 'ready';

export interface Compute {
  status: ComputeStatus;
  /** The bucket sandboxes bill to; null until known. */
  bucketId: string | null;
  /** Set when `status` is `ready`. */
  client: ComputeClient | null;
  /** Why the client isn't ready, in words (detail: the raw cause). */
  error: { message: string; detail?: string } | null;
  gatewayUrl: string;
  /** A call got 401: drop the token and mint once more. */
  onAuthError: () => void;
  /** Mint again after an error. */
  retry: () => void;
  /** Create the billing bucket when there is none (wallet consent). */
  ensureBucket: () => Promise<string>;
}

const TOKEN_MESSAGES = {
  mintFailed: 'Couldn’t get access to your sandboxes. Try again to approve it in your SSCP wallet.',
  rejected: 'The compute gateway refused your access. Try again.',
};

/** Exported for render tests, which provide a fixed value. */
export const ComputeContext = createContext<Compute | null>(null);

export function ComputeProvider({ children }: { children: ReactNode }) {
  const { buckets, loading, error: bucketsError, ensureBucket } = useOwnerBuckets();
  const bucketId = buckets[0]?.id ?? null;
  const { state, onAuthError, retry } = useComputeToken(bucketId, TOKEN_MESSAGES);
  const key = state.kind === 'ready' ? state.key : null;
  const client = useMemo(() => (key ? createComputeClient(key) : null), [key]);

  const value = useMemo<Compute>(() => {
    let status: ComputeStatus;
    let error: Compute['error'] = null;
    if (bucketsError) {
      status = 'buckets-error';
      error = { message: 'Couldn’t read your buckets from the blockchain index.', detail: bucketsError };
    } else if (!bucketId) status = loading ? 'buckets-loading' : 'no-bucket';
    else if (state.kind === 'error') {
      status = 'token-error';
      error = { message: state.message, detail: state.detail };
    } else if (!client) status = 'minting';
    else status = 'ready';
    return {
      status,
      bucketId,
      client: status === 'ready' ? client : null,
      error,
      gatewayUrl: computeConfig.gatewayUrl,
      onAuthError,
      retry,
      ensureBucket,
    };
  }, [bucketsError, bucketId, loading, state, client, onAuthError, retry, ensureBucket]);

  return <ComputeContext.Provider value={value}>{children}</ComputeContext.Provider>;
}

export function useCompute(): Compute {
  const c = useContext(ComputeContext);
  if (!c) throw new Error('useCompute outside ComputeProvider');
  return c;
}

/** For pages that only render once the client is ready (inside ComputeGate). */
export function useComputeClient(): ComputeClient {
  const c = useCompute();
  if (!c.client) throw new Error('compute client is not ready');
  return c.client;
}
