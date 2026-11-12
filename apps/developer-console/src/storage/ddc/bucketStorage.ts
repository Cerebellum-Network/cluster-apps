/**
 * Object upload/download/ACL/listing through the DDC S3 gateway.
 *
 * The gateway + S3 wiring live in `gatewayClient.ts`; the wallet credential
 * registration in `gatewayCredential.ts`.
 *
 * Credential lifecycle (per the #188 review):
 *   - Registered once per (account, gateway) and persisted in localStorage, so a
 *     reload or a second tab reuses it instead of asking the wallet to sign again.
 *   - Single-flight: concurrent callers share one in-flight registration, so N
 *     buckets do not trigger N parallel registrations.
 *   - Self-healing: an auth failure (403 / InvalidAccessKeyId / expired) drops the
 *     credential, re-registers once, and retries the operation.
 */
import type { CefSigner } from '@cef-ai/wallet';
import { storageConfig } from '../storageConfig';
import { createGatewayClient, type GatewayCredentials } from './gatewayClient';
import { registerGatewayCredential, revokeGatewayCredential } from './gatewayCredential';
import { bytesToHex } from './hex';
import type { Acl, BucketStorage, StorageObject, UploadInput } from './types';

/** A credential within this margin of expiry is replaced before use. */
const REFRESH_MARGIN_MS = 60_000;

const GATEWAY = storageConfig.ddcS3GatewayUrl;
/** localStorage key: per (account, gateway), so each wallet keeps its own credential. */
const credKey = (account: string) => `dc:gwCred:${account}:${GATEWAY}`;

function isFresh(c: GatewayCredentials | null): c is GatewayCredentials {
  // `expiresAt` is always set (capped to the delegation token's lifetime at mint),
  // so a missing expiry is treated as stale rather than fresh-forever.
  return !!c && c.expiresAt !== undefined && c.expiresAt - Date.now() > REFRESH_MARGIN_MS;
}

function readCachedCreds(account: string): GatewayCredentials | null {
  try {
    const raw = localStorage.getItem(credKey(account));
    return raw ? (JSON.parse(raw) as GatewayCredentials) : null;
  } catch {
    return null;
  }
}

function writeCachedCreds(account: string, c: GatewayCredentials): void {
  try {
    localStorage.setItem(credKey(account), JSON.stringify(c));
  } catch {
    // Ignore: private mode / quota. The in-memory copy still serves this session.
  }
}

function clearCachedCreds(account: string): void {
  try {
    localStorage.removeItem(credKey(account));
  } catch {
    // Ignore.
  }
}

/** An S3/gateway error that means the credential is stale and must be re-minted. */
function isAuthError(e: unknown): boolean {
  const name = (e as { name?: string })?.name ?? '';
  const status = (e as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
  const msg = (e as Error)?.message ?? '';
  return (
    status === 403 ||
    /InvalidAccessKeyId|ExpiredToken|AccessDenied|SignatureDoesNotMatch|Forbidden/i.test(name) ||
    /InvalidAccessKeyId|ExpiredToken|AccessDenied|403/i.test(msg)
  );
}

function contentTypeOf(input: UploadInput): string {
  if (input.contentType) return input.contentType;
  if (input.body instanceof Blob && input.body.type) return input.body.type;
  return 'application/octet-stream';
}

export function createBucketStorage(getSigner: () => CefSigner): BucketStorage {
  const gateway = createGatewayClient();
  let creds: GatewayCredentials | null = null;
  let pending: Promise<GatewayCredentials> | null = null;

  /** Current wallet account as lowercase hex (no 0x) -- throws if no session. */
  const accountHex = () => bytesToHex(getSigner().publicKey).toLowerCase();

  async function ensureCreds(forceNew = false): Promise<GatewayCredentials> {
    if (!forceNew && isFresh(creds)) return creds;
    const account = accountHex();
    if (!forceNew) {
      const cached = readCachedCreds(account);
      if (isFresh(cached)) {
        creds = cached;
        return cached;
      }
    }
    // Single-flight: share one registration across concurrent callers.
    if (!pending) {
      pending = registerGatewayCredential(getSigner, gateway)
        .then((fresh) => {
          creds = fresh;
          writeCachedCreds(account, fresh);
          return fresh;
        })
        .finally(() => {
          pending = null;
        });
    }
    return pending;
  }

  /** Run an S3 op; on an auth error, drop the credential, re-register once, retry. */
  async function withCreds<T>(op: (c: GatewayCredentials) => Promise<T>): Promise<T> {
    const c = await ensureCreds();
    try {
      return await op(c);
    } catch (e) {
      if (!isAuthError(e)) throw e;
      creds = null;
      try {
        clearCachedCreds(accountHex());
      } catch {
        // no session to key by -- re-register below will surface the real error.
      }
      const fresh = await ensureCreds(true);
      return op(fresh);
    }
  }

  return {
    async createBucket(bucketName: string): Promise<void> {
      try {
        await withCreds((c) => gateway.createBucket(c, bucketName));
      } catch (e) {
        // Idempotent: a bucket this wallet already owns is not an error.
        const msg = (e as Error)?.message ?? '';
        if (/already (own|exist)/i.test(msg)) return;
        throw e;
      }
    },

    uploadObject(input: UploadInput): Promise<void> {
      return withCreds((c) =>
        gateway.putObject(c, input.bucketName, input.key, input.body, contentTypeOf(input), input.acl),
      );
    },

    readObject(bucketName, key): Promise<Blob> {
      return withCreds((c) => gateway.getObject(c, bucketName, key));
    },

    setBucketAcl(bucketName, acl): Promise<void> {
      return withCreds((c) => gateway.setBucketAcl(c, bucketName, acl));
    },

    getBucketAcl(bucketName): Promise<Acl> {
      return withCreds((c) => gateway.getBucketAcl(c, bucketName));
    },

    listBuckets(): Promise<string[]> {
      return withCreds((c) => gateway.listBuckets(c));
    },

    async listObjects(bucketName, prefix): Promise<StorageObject[]> {
      return withCreds((c) => gateway.listObjects(c, bucketName, prefix));
    },

    deleteObject(bucketName, key): Promise<void> {
      return withCreds((c) => gateway.deleteObject(c, bucketName, key));
    },

    publicUrl(bucketName: string, key: string): string {
      // Public-read objects are served path-style off the gateway origin
      // (anonymous GET `{gateway}/{bucket}/{key}`). The CDN cannot serve gateway
      // objects -- `cdn/<bucket>/<key>` answers 400 "Invalid bucketId" and the
      // gateway writes raw pieces with chain IsPublic=false -- so the gateway
      // origin is the correct public read path (#188 review; reverts the earlier
      // CDN change, which the #185 review had wrongly requested).
      const base = GATEWAY.replace(/\/+$/, '');
      return `${base}/${encodeURIComponent(bucketName)}/${key.split('/').map(encodeURIComponent).join('/')}`;
    },

    isGatewayAuthorized(publicKey: string): Promise<boolean> {
      return gateway.getAuthStatus(publicKey);
    },

    async revokeCredentials(): Promise<void> {
      await revokeGatewayCredential(getSigner, gateway);
      try {
        clearCachedCreds(accountHex());
      } catch {
        // no session: nothing local to clear.
      }
      creds = null;
      pending = null;
    },

    resetCredentials(): void {
      // Keep the per-account localStorage credential (it is reused on the next
      // sign-in of the same wallet); just drop the in-memory copy so the next op
      // re-reads the current account's credential.
      creds = null;
      pending = null;
    },
  };
}
