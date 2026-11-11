/**
 * Object upload/download/ACL through the DDC S3 gateway, for the storage slice.
 *
 * Ported (trimmed) from ROC's `createBucketStorageService`
 * (roc/src/features/bucketStorage/browserBucketStorage.ts). The gateway and S3
 * wiring live in `gatewayClient.ts`; the wallet credential registration in
 * `gatewayCredential.ts`. Dropped from ROC: the agent-service bucket resolution,
 * prefix/layout management, and the multi-layer credential dedupe/403 self-heal
 * (one in-memory credential, refreshed near expiry, is enough here).
 *
 * NOT runtime-verified yet (needs the live gateway on an https origin the wallet
 * allows -- see STORAGE-SLICE.md).
 */
import type { CefSigner } from '@cef-ai/wallet';
import { storageConfig } from '../storageConfig';
import { createGatewayClient, type GatewayCredentials } from './gatewayClient';
import { registerGatewayCredential } from './gatewayCredential';
import type { BucketStorage, UploadInput } from './types';

/** A credential within this margin of expiry is replaced before use. */
const REFRESH_MARGIN_MS = 60_000;

/**
 * The gateway credential is wallet-wide, so cache it in sessionStorage keyed by
 * the gateway origin. Without this, a page reload drops the in-memory credential
 * and the next list/upload needs a fresh wallet signature — which silently fails
 * when the wallet handshake is flaky, so previously-uploaded objects stop showing.
 * sessionStorage is per-tab and cleared on close; every access is guarded.
 */
const credKey = `dc:gwCred:${storageConfig.ddcS3GatewayUrl}`;

function isFresh(c: GatewayCredentials | null): c is GatewayCredentials {
  return !!c && (c.expiresAt === undefined || c.expiresAt - Date.now() > REFRESH_MARGIN_MS);
}

function readCachedCreds(): GatewayCredentials | null {
  try {
    const raw = sessionStorage.getItem(credKey);
    return raw ? (JSON.parse(raw) as GatewayCredentials) : null;
  } catch {
    return null;
  }
}

function writeCachedCreds(c: GatewayCredentials): void {
  try {
    sessionStorage.setItem(credKey, JSON.stringify(c));
  } catch {
    // Ignore: private mode / quota. The in-memory copy still serves this session.
  }
}

/** Drop the cached gateway credential (on sign-out / account switch). */
export function clearCachedGatewayCreds(): void {
  try {
    sessionStorage.removeItem(credKey);
  } catch {
    // Ignore.
  }
}

function contentTypeOf(input: UploadInput): string {
  if (input.contentType) return input.contentType;
  if (input.body instanceof Blob && input.body.type) return input.body.type;
  return 'application/octet-stream';
}

export function createBucketStorage(getSigner: () => CefSigner): BucketStorage {
  const gateway = createGatewayClient();
  let creds: GatewayCredentials | null = null;

  async function ensureCreds(): Promise<GatewayCredentials> {
    if (isFresh(creds)) return creds;
    // Reuse a credential cached from an earlier page load before signing again.
    const cached = readCachedCreds();
    if (isFresh(cached)) {
      creds = cached;
      return creds;
    }
    creds = await registerGatewayCredential(getSigner, gateway);
    writeCachedCreds(creds);
    return creds;
  }

  return {
    async createBucket(bucketName: string): Promise<void> {
      const c = await ensureCreds();
      try {
        await gateway.createBucket(c, bucketName);
      } catch (e) {
        // Idempotent: a bucket this wallet already owns is not an error.
        const msg = (e as Error)?.message ?? '';
        if (/already (own|exist)/i.test(msg)) return;
        throw e;
      }
    },

    async uploadObject(input: UploadInput): Promise<void> {
      const c = await ensureCreds();
      await gateway.putObject(c, input.bucketName, input.key, input.body, contentTypeOf(input), input.acl);
    },

    async readObject(bucketName, key): Promise<Blob> {
      const c = await ensureCreds();
      return gateway.getObject(c, bucketName, key);
    },

    async setBucketAcl(bucketName, acl): Promise<void> {
      const c = await ensureCreds();
      await gateway.setBucketAcl(c, bucketName, acl);
    },

    async listObjects(bucketName, prefix): Promise<string[]> {
      const c = await ensureCreds();
      return gateway.listObjects(c, bucketName, prefix);
    },

    async deleteObject(bucketName, key): Promise<void> {
      const c = await ensureCreds();
      await gateway.deleteObject(c, bucketName, key);
    },

    publicUrl(bucketName: string, key: string): string {
      // Public-read objects are read back off the CDN host (per #185 review), not
      // the authenticated S3 gateway: the gateway is the write/signed-read path,
      // while the CDN is the public, cacheable edge for public-read objects.
      // Path-style `{cdn}/{bucket}/{key}`, same shape the gateway serves.
      const base = storageConfig.ddcCdnUrl.replace(/\/+$/, '');
      return `${base}/${encodeURIComponent(bucketName)}/${key.split('/').map(encodeURIComponent).join('/')}`;
    },

    resetCredentials(): void {
      creds = null;
      clearCachedGatewayCreds();
    },
  };
}
