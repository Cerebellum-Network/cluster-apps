/**
 * Who the Sandboxes and Agents pages call the compute gateway as: the signed-in
 * wallet's first on-chain bucket (the same one Inference bills to) and the
 * console's COMPUTE token for it. Pages read it with `useCompute()`.
 */
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

import { inferenceConfig } from '~/inference/inferenceConfig';
import { useOwnerBuckets } from '~/inference/useInference';
import { createComputeClient, type ComputeClient } from './client';
import { computeConfig, isComputeConfigured } from './computeConfig';
import { useComputeToken } from './useComputeToken';

export type ComputeStatus =
  | 'not-configured'
  | 'buckets-loading'
  | 'buckets-error'
  | 'no-bucket'
  | 'minting'
  | 'token-error'
  | 'ready';

export interface Compute {
  status: ComputeStatus;
  /** The bucket sandboxes bill to; null until known. */
  bucketId: string | null;
  /** Set when `status` is `ready`. */
  client: ComputeClient | null;
  /** Why the client isn't ready, in words (detail: the raw cause). */
  error: { message: string; detail?: string } | null;
  gatewayUrl: string;
  /** The network whose buckets the console bills, and whose gateway it calls. */
  network: string;
  /** A call got 401: drop the token and mint once more. */
  onAuthError: () => void;
  /** Mint again after an error. */
  retry: () => void;
  /** Create the billing bucket when there is none (wallet consent). */
  ensureBucket: () => Promise<string>;
  /** When the console's COMPUTE token stops working (ms since the epoch); set when `status` is `ready`. */
  tokenExpiresAt: number | null;
  /**
   * Store the console's COMPUTE token as the bucket secret `name`, `Authorization: Bearer <token>`, through the
   * gateway's write-only secrets API. The inference gateway of the same network takes that token as the model key
   * for this bucket; the secret stops working at `tokenExpiresAt`. Null until `status` is `ready`.
   */
  storeTokenAsSecret: ((name: string) => Promise<void>) | null;
}

const TOKEN_MESSAGES = {
  mintFailed: 'Couldn’t get access to your sandboxes. Try again to approve it in your SSCP wallet.',
  rejected: 'The compute gateway refused your access. Try again.',
};

/** Exported for render tests, which provide a fixed value. */
export const ComputeContext = createContext<Compute | null>(null);

export function ComputeProvider({ children }: { children: ReactNode }) {
  const { buckets, loading, error: bucketsError, ensureBucket } = useOwnerBuckets();
  const configured = isComputeConfigured();
  const bucketId = buckets[0]?.id ?? null;
  // No gateway, no token: the wallet is not asked to sign for a gateway that isn't there.
  const { state, onAuthError, retry } = useComputeToken(configured ? bucketId : null, TOKEN_MESSAGES);
  const key = state.kind === 'ready' ? state.key : null;
  const tokenExpiresAt = state.kind === 'ready' ? state.expiresAt : null;
  const client = useMemo(() => (key ? createComputeClient(key) : null), [key]);
  const storeToken = useCallback(
    (name: string) =>
      client && key
        ? client.putSecret(name, {
            type: 'header',
            header: 'Authorization',
            value: `Bearer ${key}`,
            // The token is a key only for this network's inference gateway: bind it there and nowhere else.
            hosts: [new URL(inferenceConfig.gatewayUrl).hostname],
          })
        : Promise.reject(new Error('the compute client is not ready')),
    [client, key],
  );

  const value = useMemo<Compute>(() => {
    let status: ComputeStatus;
    let error: Compute['error'] = null;
    if (!configured) {
      status = 'not-configured';
      error = {
        message: `This console has no compute gateway for ${computeConfig.network}. Sandboxes and agents run on devnet.`,
        detail:
          'Set compute.gatewayUrl in /config.js (VITE_COMPUTE_GATEWAY_URL for a local run) to the compute gateway of the network the console bills, or run the console against devnet (apps/developer-console/README.md).',
      };
    } else if (bucketsError) {
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
      network: computeConfig.network,
      onAuthError,
      retry,
      ensureBucket,
      tokenExpiresAt: status === 'ready' ? tokenExpiresAt : null,
      storeTokenAsSecret: status === 'ready' ? storeToken : null,
    };
  }, [
    configured,
    bucketsError,
    bucketId,
    loading,
    state,
    client,
    onAuthError,
    retry,
    ensureBucket,
    tokenExpiresAt,
    storeToken,
  ]);

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
