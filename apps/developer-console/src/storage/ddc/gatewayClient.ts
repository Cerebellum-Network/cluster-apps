/**
 * Minimal DDC S3 Gateway client for the storage slice.
 *
 * Ported (trimmed) from ROC's `createHttpBucketStorageGatewayClient`
 * (roc/src/features/bucketStorage/browserBucketStorage.ts). Dropped from ROC's
 * version: the per-wallet credential-cap management, targeted revoke, signed
 * list, multi-instance dedupe, and presigned GET. Kept: the S3Client wiring and
 * the two middlewares that make the gateway's CORS accept the request
 * (strip the SDK's flexible-checksum + user-agent headers, set
 * `x-amz-content-sha256`, and drop the trailing bucket slash).
 *
 * NOT runtime-verified yet (needs the live gateway on an https origin the wallet
 * allows -- see STORAGE-SLICE.md). Faithful to ROC's proven shape.
 */
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateBucketCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetBucketAclCommand,
  GetObjectCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  PutBucketAclCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';

/** Bodies larger than this are uploaded with S3 multipart; smaller ones in one PUT. */
const MULTIPART_THRESHOLD = 10 * 1024 * 1024;
/** Multipart part size (S3 minimum is 5 MiB, except the last part). */
const MULTIPART_PART_SIZE = 5 * 1024 * 1024;
import { storageConfig } from '../storageConfig';
import type { Acl } from './types';

/** One object in a bucket listing: its key and real byte size. */
export interface GatewayObject {
  key: string;
  size: number;
}

/** A bucket as the gateway enumerates it (ListBuckets), with its ACL. */
export interface GatewayBucket {
  name: string;
  isPublic: boolean;
}

export interface GatewayInfo {
  gatewayPublicKey: string;
  clusterId?: string;
  region: string;
}

export interface GatewayCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  /** ms since epoch, from the registration's `expires_at` (absent if the gateway named none). */
  expiresAt?: number;
}

export interface RegisterCredentialsInput {
  publicKey: string;
  signature: string;
  signatureType: string;
  delegationToken: string;
  label?: string;
}

// ── byte / hash helpers (ported from ROC @/utils + browserBucketStorage) ────
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function bodyToArrayBuffer(body: unknown): Promise<ArrayBuffer | undefined> {
  if (typeof body === 'string') return toArrayBuffer(new TextEncoder().encode(body));
  if (body instanceof Uint8Array) return toArrayBuffer(body);
  if (body instanceof ArrayBuffer) return body;
  if (ArrayBuffer.isView(body)) {
    return toArrayBuffer(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
  }
  if (body instanceof Blob) return body.arrayBuffer();
  return undefined;
}

async function sha256HexFromBody(body: unknown): Promise<string | undefined> {
  const buffer = await bodyToArrayBuffer(body);
  if (!buffer) return undefined;
  return toHex(await crypto.subtle.digest('SHA-256', new Uint8Array(buffer)));
}

function findHeaderKey(headers: Record<string, string | undefined>, name: string): string | undefined {
  const n = name.toLowerCase();
  return Object.keys(headers).find((k) => k.toLowerCase() === n);
}
function deleteHeader(headers: Record<string, string | undefined>, name: string): void {
  const k = findHeaderKey(headers, name);
  if (k) delete headers[k];
}
function setHeader(headers: Record<string, string | undefined>, name: string, value: string): void {
  deleteHeader(headers, name);
  headers[name] = value;
}

async function parseJson<T>(res: Response, msg: string): Promise<T> {
  if (!res.ok) throw new Error(`${msg}: ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * Canonical `POST /auth/credentials` body. The gateway verifies `X-Signature`
 * over the exact raw body bytes, so the signer and the sender MUST build
 * byte-identical JSON -- both go through this helper.
 */
export function buildRegistrationBody(delegationToken: string, label?: string): string {
  return JSON.stringify({ delegation_token: delegationToken, ...(label ? { label } : {}) });
}

// ── S3 client wired for the DDC gateway ─────────────────────────────────────
function createS3Client(baseUrl: string, creds: GatewayCredentials): S3Client {
  const client = new S3Client({
    endpoint: baseUrl,
    forcePathStyle: true,
    maxAttempts: 1,
    region: creds.region,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey },
  });
  client.middlewareStack.remove('getUserAgentMiddleware');
  client.middlewareStack.remove('addExpectContinueMiddleware');
  // The SDK auto-emits flexible-checksum + user-agent headers the gateway's CORS
  // preflight doesn't whitelist, so the browser blocks the request. Strip them
  // and set x-amz-content-sha256 by hand so SigV4 still has the body integrity.
  client.middlewareStack.addRelativeTo(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK middleware signature
    (next: (arg0: any) => any) => async (args: any) => {
      const request = args.request as { body?: unknown; headers?: Record<string, string | undefined> } | undefined;
      if (request?.headers) {
        for (const h of [
          'amz-sdk-invocation-id',
          'amz-sdk-request',
          'x-amz-user-agent',
          'x-amz-checksum-crc32',
          'x-amz-checksum-crc32c',
          'x-amz-checksum-crc64nvme',
          'x-amz-checksum-sha1',
          'x-amz-checksum-sha256',
          'x-amz-sdk-checksum-algorithm',
        ]) {
          deleteHeader(request.headers, h);
        }
        const payloadHash = await sha256HexFromBody(request.body);
        if (payloadHash) setHeader(request.headers, 'x-amz-content-sha256', payloadHash);
      }
      return next(args);
    },
    { name: 'removeDdcCorsUnsupportedSdkHeaders', relation: 'before', toMiddleware: 'awsAuthMiddleware', override: true },
  );
  // A bare-bucket path arrives as `/bucket/`; the gateway wants `/bucket`.
  client.middlewareStack.add(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK middleware signature
    (next: (arg0: any) => any) => async (args: any) => {
      const request = args.request as { path?: string } | undefined;
      if (request?.path && /^\/[^/]+\/$/.test(request.path)) {
        request.path = request.path.replace(/\/$/, '');
      }
      return next(args);
    },
    { name: 'removeTrailingBucketSlashForDdcGateway', step: 'build' },
  );
  return client;
}

export interface GatewayClient {
  getInfo(): Promise<GatewayInfo>;
  registerCredentials(input: RegisterCredentialsInput): Promise<GatewayCredentials>;
  /**
   * Create the bucket at the gateway. The gateway authenticates (SigV4), mints
   * the on-chain bucket on the wallet's behalf (needs the gateway added as a
   * chain proxy) and inserts its own `buckets` row -- the precondition for
   * uploads and signed reads. A chain-only bucket (chainClient.createBucket) is
   * NOT known to the gateway.
   */
  createBucket(creds: GatewayCredentials, bucket: string): Promise<void>;
  putObject(creds: GatewayCredentials, bucket: string, key: string, body: Blob | Uint8Array | string, contentType: string, acl?: Acl): Promise<void>;
  getObject(creds: GatewayCredentials, bucket: string, key: string): Promise<Blob>;
  setBucketAcl(creds: GatewayCredentials, bucket: string, acl: Acl): Promise<void>;
  getBucketAcl(creds: GatewayCredentials, bucket: string): Promise<Acl>;
  /** Every bucket this wallet owns, as the gateway enumerates them (ListBuckets). */
  listBuckets(creds: GatewayCredentials): Promise<string[]>;
  /** Every object under `prefix`, following ContinuationToken to exhaustion; keys + real sizes. */
  listObjects(creds: GatewayCredentials, bucket: string, prefix?: string): Promise<GatewayObject[]>;
  deleteObject(creds: GatewayCredentials, bucket: string, key: string): Promise<void>;
  /**
   * Whether the gateway is registered as the wallet's on-chain proxy. Signed GET
   * (`/auth/status`) over an EMPTY body; reads `gateway_proxy_registered`.
   */
  getAuthStatus(input: { publicKey: string; signature: string; signatureType: string }): Promise<boolean>;
  /**
   * Revoke this wallet's gateway credentials (so they stop working at once, not in
   * up to 24h). Signed DELETE (`/auth/credentials`) over `body`
   * (`{"access_key_id":"<key>"}` for a specific credential, or empty for the
   * legacy row). The signature must cover these exact `body` bytes.
   */
  deleteCredentials(input: { publicKey: string; signature: string; signatureType: string; body: string }): Promise<void>;
}

export function createGatewayClient(gatewayUrl: string = storageConfig.ddcS3GatewayUrl): GatewayClient {
  const baseUrl = gatewayUrl.replace(/\/+$/, '');

  return {
    async getInfo(): Promise<GatewayInfo> {
      const res = await fetch(`${baseUrl}/auth/info`);
      const data = await parseJson<{ gateway_public_key?: string; cluster_id?: string; region?: string }>(
        res,
        'Failed to load DDC S3 Gateway info',
      );
      if (!data.gateway_public_key || !data.region) throw new Error('DDC S3 Gateway returned malformed auth info.');
      return { gatewayPublicKey: data.gateway_public_key, clusterId: data.cluster_id, region: data.region };
    },

    async registerCredentials(input: RegisterCredentialsInput): Promise<GatewayCredentials> {
      const body = buildRegistrationBody(input.delegationToken, input.label);
      const res = await fetch(`${baseUrl}/auth/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Public-Key': input.publicKey,
          'X-Signature': input.signature,
          'X-Signature-Type': input.signatureType,
        },
        body,
      });
      const data = await parseJson<{
        access_key_id?: string;
        secret_access_key?: string;
        region?: string;
        expires_at?: string | null;
      }>(res, 'Failed to register DDC S3 Gateway credential');
      if (!data.access_key_id || !data.secret_access_key || !data.region) {
        throw new Error('DDC S3 Gateway returned an incomplete credential.');
      }
      return {
        accessKeyId: data.access_key_id,
        secretAccessKey: data.secret_access_key,
        region: data.region,
        expiresAt: data.expires_at ? Date.parse(data.expires_at) : undefined,
      };
    },

    async createBucket(creds, bucket): Promise<void> {
      await createS3Client(baseUrl, creds).send(new CreateBucketCommand({ Bucket: bucket }));
    },

    async putObject(creds, bucket, key, body, contentType, acl): Promise<void> {
      const client = createS3Client(baseUrl, creds);
      const blob: Blob =
        body instanceof Blob ? body : new Blob([body instanceof Uint8Array ? toArrayBuffer(body) : body], { type: contentType });

      if (blob.size <= MULTIPART_THRESHOLD) {
        const single: PutObjectCommandInput['Body'] = blob;
        await client.send(
          new PutObjectCommand({ Bucket: bucket, Key: key, Body: single, ContentType: contentType, ACL: acl }),
        );
        return;
      }

      // Large file: S3 multipart. Upload 5 MiB parts, then complete; abort on any
      // failure so the gateway does not keep orphaned parts.
      const created = await client.send(
        new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: contentType, ACL: acl }),
      );
      const uploadId = created.UploadId;
      if (!uploadId) throw new Error('Gateway did not return an upload id for the multipart upload.');
      try {
        const parts: { ETag: string; PartNumber: number }[] = [];
        let partNumber = 1;
        for (let offset = 0; offset < blob.size; offset += MULTIPART_PART_SIZE) {
          const chunk = blob.slice(offset, Math.min(offset + MULTIPART_PART_SIZE, blob.size));
          const res = await client.send(
            new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: partNumber, Body: chunk }),
          );
          if (!res.ETag) throw new Error(`Gateway did not return an ETag for part ${partNumber}.`);
          parts.push({ ETag: res.ETag, PartNumber: partNumber });
          partNumber += 1;
        }
        await client.send(
          new CompleteMultipartUploadCommand({
            Bucket: bucket,
            Key: key,
            UploadId: uploadId,
            MultipartUpload: { Parts: parts },
          }),
        );
      } catch (e) {
        await client
          .send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }))
          .catch(() => undefined);
        throw e;
      }
    },

    async getObject(creds, bucket, key): Promise<Blob> {
      const out = await createS3Client(baseUrl, creds).send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!out.Body) throw new Error(`Gateway returned no body for ${bucket}/${key}.`);
      const bytes = await out.Body.transformToByteArray();
      return new Blob([toArrayBuffer(bytes)]);
    },

    async setBucketAcl(creds, bucket, acl): Promise<void> {
      await createS3Client(baseUrl, creds).send(new PutBucketAclCommand({ Bucket: bucket, ACL: acl }));
    },

    async getBucketAcl(creds, bucket): Promise<Acl> {
      // The bucket is public when a grant gives the AllUsers group READ. Anything
      // else -- including no ACL grants -- is private.
      const out = await createS3Client(baseUrl, creds).send(new GetBucketAclCommand({ Bucket: bucket }));
      const publicRead = (out.Grants ?? []).some(
        (g) =>
          (g.Permission === 'READ' || g.Permission === 'FULL_CONTROL') &&
          /AllUsers/i.test(g.Grantee?.URI ?? ''),
      );
      return publicRead ? 'public-read' : 'private';
    },

    async listBuckets(creds): Promise<string[]> {
      const out = await createS3Client(baseUrl, creds).send(new ListBucketsCommand({}));
      return (out.Buckets ?? []).map((b) => b.Name).filter((n): n is string => !!n);
    },

    async listObjects(creds, bucket, prefix): Promise<GatewayObject[]> {
      const client = createS3Client(baseUrl, creds);
      const objects: GatewayObject[] = [];
      let token: string | undefined;
      try {
        do {
          const out = await client.send(
            new ListObjectsV2Command({
              Bucket: bucket,
              Prefix: prefix || undefined,
              MaxKeys: 1000,
              ContinuationToken: token,
            }),
          );
          for (const o of out.Contents ?? []) {
            if (o.Key) objects.push({ key: o.Key, size: o.Size ?? 0 });
          }
          token = out.IsTruncated ? out.NextContinuationToken : undefined;
        } while (token);
        return objects;
      } catch (e) {
        // A bucket the gateway has no row for (e.g. a chain-only bucket created
        // outside the gateway) answers NoSuchBucket -- "no objects", not an error.
        // Any other failure is real and must surface (not be cached as an empty,
        // "fetched" bucket), so re-throw it.
        if ((e as { name?: string })?.name === 'NoSuchBucket') return [];
        throw e;
      }
    },

    async deleteObject(creds, bucket, key): Promise<void> {
      await createS3Client(baseUrl, creds).send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },

    async getAuthStatus(input): Promise<boolean> {
      // Signed GET /auth/status over an EMPTY body (the gateway's
      // verifyWalletRequest checks the signature over the raw body, which is empty
      // for GET). Reads `gateway_proxy_registered` -- whether the gateway already
      // holds the wallet's on-chain proxy, so a returning device can skip a
      // needless add_proxy prompt + fee. A non-OK response is treated as "not
      // registered" (the caller then falls through to addProxy, which is idempotent).
      try {
        const res = await fetch(`${baseUrl}/auth/status`, {
          cache: 'no-store',
          headers: {
            'X-Public-Key': input.publicKey,
            'X-Signature': input.signature,
            'X-Signature-Type': input.signatureType,
          },
        });
        if (!res.ok) return false;
        const data = (await res.json()) as { gateway_proxy_registered?: boolean };
        return data.gateway_proxy_registered === true;
      } catch {
        return false;
      }
    },

    async deleteCredentials(input): Promise<void> {
      // Signed DELETE /auth/credentials. The signature covers the exact `body`
      // bytes (`{"access_key_id":"<key>"}` to target a specific credential), which
      // the gateway binds to the wallet signature (internal/mgmt/handler.go
      // RevokeCredential + auth.go verifyWalletRequest).
      //
      // Live note (#188): /auth/status (empty-body signature, same scheme) verifies
      // 200, but this DELETE still returns 401 live -- a residual nuance in how the
      // signed non-empty body is transmitted/verified for a DELETE. revokeGateway
      // treats this as best-effort (the proxy removal is the main effect; the
      // credential expires within 24h regardless), so a 401 is logged, not fatal.
      // Follow-up: compare the signed bytes with the body the gateway receives.
      const res = await fetch(`${baseUrl}/auth/credentials`, {
        method: 'DELETE',
        headers: {
          'X-Public-Key': input.publicKey,
          'X-Signature': input.signature,
          'X-Signature-Type': input.signatureType,
          ...(input.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: input.body || undefined,
      });
      // 404 = already gone; treat as success.
      if (!res.ok && res.status !== 404) {
        throw new Error(`Failed to revoke DDC S3 Gateway credentials: ${res.status}`);
      }
    },
  };
}
