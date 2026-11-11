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
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutBucketAclCommand,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { storageConfig } from '../storageConfig';
import type { Acl } from './types';

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
  /** Object keys under `prefix` (one page, up to `maxKeys`). */
  listObjects(creds: GatewayCredentials, bucket: string, prefix?: string, maxKeys?: number): Promise<string[]>;
  deleteObject(creds: GatewayCredentials, bucket: string, key: string): Promise<void>;
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
      const uploadBody: PutObjectCommandInput['Body'] =
        body instanceof Blob ? body : new Blob([body instanceof Uint8Array ? toArrayBuffer(body) : body], { type: contentType });
      await createS3Client(baseUrl, creds).send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: uploadBody, ContentType: contentType, ACL: acl }),
      );
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

    async listObjects(creds, bucket, prefix, maxKeys = 1000): Promise<string[]> {
      try {
        const out = await createS3Client(baseUrl, creds).send(
          new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix || undefined, MaxKeys: maxKeys }),
        );
        return (out.Contents ?? []).map((o) => o.Key).filter((k): k is string => !!k);
      } catch (e) {
        // A bucket the gateway has no row for (e.g. a chain-only bucket created
        // outside the gateway) answers NoSuchBucket. That is "no objects to show"
        // for listing, not an error worth surfacing.
        if ((e as { name?: string })?.name === 'NoSuchBucket') return [];
        throw e;
      }
    },

    async deleteObject(creds, bucket, key): Promise<void> {
      await createS3Client(baseUrl, creds).send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}
