/**
 * Storage-slice interfaces.
 *
 * These mirror the API the current DDC stack (SDK v3 + the DDC S3 gateway)
 * already exposes in ROC, kept as slice-local interfaces so the UI and the
 * react-query hooks can be written against a stable shape while the concrete
 * implementations (signer.ts, chainClient.ts, bucketStorage.ts) are ported.
 *
 * Port sources (ROC, which runs the current SDK v3):
 *   - ChainClient      <- roc/src/features/account/chainClient.ts
 *   - BucketStorage    <- roc/src/features/bucketStorage/browserBucketStorage.ts
 *
 * The signer is the SDK's own `Signer` (implemented by CefDdcSigner in
 * cefDdcSigner.ts), re-exported here so call sites take one type.
 */
import type { Signer } from '@cere-ddc-sdk/blockchain';

export type { Signer };

/** ACL a bucket/object is stored under. `public-read` is readable via the CDN. */
export type Acl = 'public-read' | 'private';

/** On-chain bucket + deposit operations (SDK v3 `connect({ network }).customers`). */
export interface ChainClient {
  /** Active DDC deposit for `address` in the configured cluster, in the chain's smallest unit. */
  getDeposit(address: string): Promise<bigint>;
  /** Free (spendable) CERE balance of `address`, smallest unit; 0 if it can't be read. */
  getBalance(address: string): Promise<bigint>;
  /** Lock `value` (smallest unit) as a new/topped-up deposit in the configured cluster. */
  deposit(value: bigint, signer: Signer): Promise<void>;
  /** Create a bucket in the configured cluster; resolves to the new bucket id. */
  createBucket(signer: Signer, options?: { isPublic?: boolean }): Promise<bigint>;
  /** Hydrate one bucket, or undefined if it does not exist. */
  getBucket(bucketId: bigint): Promise<BucketInfo | undefined>;
  /** Flip a bucket's on-chain public/private flag. */
  setBucketAccess(bucketId: bigint, isPublic: boolean, signer: Signer): Promise<void>;
  /** Add `delegateSs58` as a NonTransfer proxy (e.g. the storage gateway). Returns the tx hash. */
  addProxy(delegateSs58: string, signer: Signer): Promise<string>;
  /** Remove `delegateSs58` as a NonTransfer proxy (revoke the gateway). Returns the tx hash. */
  removeProxy(delegateSs58: string, signer: Signer): Promise<string>;
}

export interface BucketInfo {
  bucketId: bigint;
  ownerId: string;
  isPublic: boolean;
  isRemoved: boolean;
}

export interface UploadInput {
  bucketName: string;
  key: string;
  body: Blob | Uint8Array | string;
  /** MIME type; defaults to the Blob's own type, else application/octet-stream. */
  contentType?: string;
  acl?: Acl;
}

/** One object in a bucket listing: its key and real byte size. */
export interface StorageObject {
  key: string;
  size: number;
}

/** Object upload/download/ACL through the DDC S3 gateway. */
export interface BucketStorage {
  /** Create the bucket at the gateway (mints on-chain + the gateway row). Idempotent. */
  createBucket(bucketName: string): Promise<void>;
  uploadObject(input: UploadInput): Promise<void>;
  /** Download object bytes (private objects require the wallet's gateway credential). */
  readObject(bucketName: string, key: string): Promise<Blob>;
  setBucketAcl(bucketName: string, acl: Acl): Promise<void>;
  /** Read a bucket's ACL (public/private) from the gateway. */
  getBucketAcl(bucketName: string): Promise<Acl>;
  /** Every bucket this wallet owns, as the gateway enumerates them. */
  listBuckets(): Promise<string[]>;
  /** Every object in the bucket (optionally under `prefix`), paginated, with real sizes. */
  listObjects(bucketName: string, prefix?: string): Promise<StorageObject[]>;
  deleteObject(bucketName: string, key: string): Promise<void>;
  /** Public URL for a `public-read` object (anonymous GET off the gateway origin). */
  publicUrl(bucketName: string, key: string): string;
  /** Whether the gateway holds this wallet's on-chain proxy (skip a needless re-grant). */
  isGatewayAuthorized(): Promise<boolean>;
  /** Revoke the wallet's gateway credentials (DELETE /auth/credentials). */
  revokeCredentials(): Promise<void>;
  /** Drop the cached gateway credential (in-memory + persisted), e.g. on account switch. */
  resetCredentials(): void;
}
