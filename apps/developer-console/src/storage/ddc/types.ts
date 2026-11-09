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
  /** Create a bucket in the configured cluster; resolves to the new bucket id. */
  createBucket(signer: Signer, options?: { isPublic?: boolean }): Promise<bigint>;
  /** Hydrate one bucket, or undefined if it does not exist. */
  getBucket(bucketId: bigint): Promise<BucketInfo | undefined>;
  /** Add `delegateSs58` as a NonTransfer proxy (e.g. the storage gateway). Returns the tx hash. */
  addProxy(delegateSs58: string, signer: Signer): Promise<string>;
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

/** Object upload/download/ACL through the DDC S3 gateway. */
export interface BucketStorage {
  /** Create the bucket at the gateway (mints on-chain + the gateway row). Idempotent. */
  createBucket(bucketName: string): Promise<void>;
  uploadObject(input: UploadInput): Promise<void>;
  /** Download object bytes (private objects require the wallet's gateway credential). */
  readObject(bucketName: string, key: string): Promise<Blob>;
  setBucketAcl(bucketName: string, acl: Acl): Promise<void>;
  /** Object keys in the bucket (optionally under `prefix`). */
  listObjects(bucketName: string, prefix?: string): Promise<string[]>;
  deleteObject(bucketName: string, key: string): Promise<void>;
  /** Public CDN URL for a `public-read` object. */
  publicUrl(bucketName: string, key: string): string;
}
