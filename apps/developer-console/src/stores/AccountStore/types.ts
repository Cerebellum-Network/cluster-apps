import type { CefSigner } from '@cef-ai/wallet';
import type { BucketInfo, BucketStorage } from '~/storage/ddc/types';

/** Mirrors the wallet session states exposed by the React SessionProvider. */
export type AccountStatus = 'idle' | 'connecting' | 'waiting' | 'connected' | 'error' | 'expired';

export type Bucket = {
  id: bigint;
  isPublic: boolean;
  isRemoved: boolean;
  storedBytes?: number;
};

/**
 * What the React wallet SessionProvider pushes into the MobX AccountStore. The
 * CEF wallet is hook-based, so the store cannot own it directly; the session
 * bridge (see App.tsx) injects the connected identity + signer/token accessors.
 */
export interface SessionInput {
  state: AccountStatus;
  /** Hex public key, lowercase, no 0x (the index + gateway key by this). */
  account: string | null;
  /** Cere SS58 address (chain reads + the wallet chip + deposit QR). */
  address: string | null;
  email: string | null;
  getSigner: () => CefSigner;
  getToken: () => Promise<string>;
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
  readonly status: AccountStatus;

  isReady(): this is ReadyAccount;
  createBucket(params: { isPublic?: boolean }): Promise<bigint>;
  saveBucket(bucketId: bigint, params: { isPublic: boolean }): Promise<void>;
  topUp(amount: number): Promise<void>;
  /** A GET AuthToken string for a private object, to append as `?token=`. */
  createAuthToken(bucketId: bigint, pieceCid: string): Promise<string>;
  /** Read one bucket's on-chain record (for its public/private flag). */
  getBucketInfo(bucketId: bigint): Promise<BucketInfo | undefined>;
  /** Authorize the DDC storage gateway to act for this wallet (once per account). */
  authorizeGateway(): Promise<void>;
  refreshBuckets(): Promise<void>;
}

export type ReadyAccount = Account & {
  readonly account: string;
  readonly address: string;
};
