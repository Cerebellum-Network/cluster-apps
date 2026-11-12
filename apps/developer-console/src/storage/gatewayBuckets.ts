/**
 * Gateway bucket naming.
 *
 * The bucket list and each bucket's public/private flag are read from the gateway
 * itself (ListBuckets / GetBucketAcl) and the proxy state from `/auth/status`, so
 * nothing is tracked client-side any more -- the only thing the console still owns
 * is minting a fresh, S3-valid name for a new bucket.
 */

/**
 * A fresh, S3-valid bucket name: lowercase, 3–63 chars, `[a-z0-9-]`, starts/ends
 * alphanumeric, no `_`. `dc-<base36 time>-<random>` is unique enough per account.
 */
export function generateBucketName(): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `dc-${time}-${rand}`.toLowerCase();
}
