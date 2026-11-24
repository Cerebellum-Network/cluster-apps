import type { GatewayCredentials } from '~/storage/ddc/gatewayClient';
import type { CefSigner } from '@cef-ai/wallet';
import type { BucketStorage } from '~/storage/ddc/types';

/** Mirrors the wallet session states exposed by the React SessionProvider. */
export type AccountStatus = 'idle' | 'connecting' | 'waiting' | 'connected' | 'error' | 'expired';

/**
 * A gateway bucket, addressed by its string name. Sourced from the gateway
 * (ListBuckets for the names, GetBucketAcl for the public flag).
 */
export type Bucket = {
  name: string;
  isPublic: boolean;
  storedBytes?: number;
};

/**
 * What the React wallet SessionProvider pushes into the MobX AccountStore. The
 * CEF wallet is hook-based, so the store cannot own it directly; the session
 * bridge (see App.tsx) injects the connected identity + signer accessor.
 */
export interface SessionInput {
  state: AccountStatus;
  /** Hex public key, lowercase, no 0x (the index + gateway key by this). */
  account: string | null;
  /** Cere SS58 address (chain reads + the wallet chip + deposit QR). */
  address: string | null;
  email: string | null;
  getSigner: () => CefSigner;
}

export interface Account {
  /** Object upload/download/ACL through the DDC S3 gateway. */
  readonly storage: BucketStorage;

  readonly account?: string;
  readonly address?: string;
  readonly email?: string;
  readonly balance?: number;
  readonly deposit?: number;
  readonly buckets?: Bucket[];
  readonly bucketsLoading?: boolean;
  /** Why the last bucket listing failed (then `buckets` is stale or empty), or null. */
  readonly bucketsError?: string | null;
  readonly status: AccountStatus;
  /** Whether this wallet has authorized the storage gateway (gates the revoke control). */
  readonly gatewayAuthorized?: boolean;

  isReady(): this is ReadyAccount;
  /** Create a gateway bucket (authorizing the gateway first if needed); returns its name. */
  createBucket(): Promise<string>;
  saveBucket(name: string, params: { isPublic: boolean }): Promise<void>;
  /**
   * Mint a COMPUTE-only Inference API key (base58 DDC bearer) scoped to
   * `bucketId`, signed by this wallet. Shown once; stateless (expires only).
   */
  createInferenceApiKey(bucketId: bigint, ttlMs: number): Promise<string>;
  /**
   * Register a separate DDC S3 gateway credential (its own label) to hand to
   * another client, e.g. the `cere` CLI for agent definitions. Wallet-wide,
   * lives as long as its 24h delegation token. Shown once by the caller.
   */
  createS3Credential(label: string): Promise<GatewayCredentials>;
  /** Revoke the storage gateway's on-chain proxy authorization for this wallet. */
  revokeGateway(): Promise<void>;
  topUp(amount: number): Promise<void>;
  refreshBuckets(): Promise<void>;
}

export type ReadyAccount = Account & {
  readonly account: string;
  readonly address: string;
};
