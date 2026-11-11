import type { CefSigner } from '@cef-ai/wallet';
import type { BucketStorage } from '~/storage/ddc/types';

/** Mirrors the wallet session states exposed by the React SessionProvider. */
export type AccountStatus = 'idle' | 'connecting' | 'waiting' | 'connected' | 'error' | 'expired';

/**
 * A gateway bucket, addressed by its string name (the DDC S3 gateway resolves by
 * name). Tracked client-side since the gateway has no "list my buckets".
 */
export type Bucket = {
  name: string;
  isPublic: boolean;
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
  /** Create a gateway bucket (authorizing the gateway first if needed); returns its name. */
  createBucket(): Promise<string>;
  saveBucket(name: string, params: { isPublic: boolean }): Promise<void>;
  topUp(amount: number): Promise<void>;
  refreshBuckets(): void;
}

export type ReadyAccount = Account & {
  readonly account: string;
  readonly address: string;
};
