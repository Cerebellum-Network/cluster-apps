import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CefSigner } from '@cef-ai/wallet';
import { createChainClient } from './ddc/chainClient';
import { createGatewayClient } from './ddc/gatewayClient';
import { createDdcSigner } from './ddc/signer';
import { listOwnerBuckets } from './ddc/ownerBuckets';

// One chain client per tab; the WS underneath is a module singleton (see
// chainClient.ts), so re-creating the wrapper object is cheap.
const chain = createChainClient();

export const storageKeys = {
  buckets: (a: string) => ['storage', 'buckets', a] as const,
  deposit: (a: string) => ['storage', 'deposit', a] as const,
  gatewayInfo: () => ['storage', 'gatewayInfo'] as const,
};

/**
 * The gateway's public key / region (`GET /auth/info`). Prefetched so the
 * "Authorize gateway" click can sign immediately -- a network round-trip inside
 * the click handler pushes the wallet's consent popup past the user-gesture
 * window and the popup hangs at "waiting for host".
 */
export const useGatewayInfo = () =>
  useQuery({ queryKey: storageKeys.gatewayInfo(), queryFn: () => createGatewayClient().getInfo(), staleTime: Infinity });

/**
 * The account's buckets from the blockchain index (ddc/ownerBuckets.ts). Removed
 * buckets are filtered out here; the page shows live buckets only.
 */
export const useOwnerBuckets = (account: string | null) =>
  useQuery({
    queryKey: storageKeys.buckets(account ?? ''),
    enabled: !!account,
    queryFn: async () => {
      const all = await listOwnerBuckets(account!);
      return all.filter((b) => !b.isRemoved);
    },
  });

/**
 * The account's active DDC deposit in the configured cluster, in the chain's
 * smallest unit. A read-only exercise of the chain client (connect + a pallet
 * read) -- no signing, no funds required.
 */
export const useDeposit = (address: string | null) =>
  useQuery({
    queryKey: storageKeys.deposit(address ?? ''),
    enabled: !!address,
    queryFn: () => chain.getDeposit(address!),
  });

/**
 * Create a bucket on chain (an extrinsic -- raises the wallet's consent screen).
 * `getSigner` is the session's `CefSigner` resolver; the consent string is
 * attached via `.describing(...)`. On success, the bucket list is refetched.
 */
export function useCreateBucket(getSigner: () => CefSigner, account: string | null, onCreated?: (id: bigint) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      const signer = createDdcSigner(getSigner).describing('Create a storage bucket');
      return chain.createBucket(signer, { isPublic: false });
    },
    onSuccess: (id) => {
      onCreated?.(id);
      if (account) void qc.invalidateQueries({ queryKey: storageKeys.buckets(account) });
    },
  });
}

/**
 * Add the DDC S3 gateway as a chain proxy for the wallet (one-time). The gateway
 * creates buckets on the wallet's behalf via Proxy.proxy, so this must happen
 * before `bucketStorage.createBucket` works. An extrinsic -> raises wallet consent.
 */
export function useAuthorizeGateway(getSigner: () => CefSigner, gatewaySs58: string | undefined) {
  return useMutation({
    mutationFn: async () => {
      if (!gatewaySs58) throw new Error('Gateway info not loaded yet.');
      // No `await` before the sign: the wallet's consent popup must open inside
      // the click gesture (see chainClient.addProxy and useGatewayInfo).
      const signer = createDdcSigner(getSigner).describing('Authorize the DDC storage gateway');
      return chain.addProxy(gatewaySs58, signer);
    },
  });
}
