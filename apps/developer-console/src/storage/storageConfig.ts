/**
 * Storage-slice runtime configuration.
 *
 * Same pattern as the app's `src/config.ts`: a deployed build reads these from
 * `/config.js` (`window.__RUNTIME_CONFIG__`, mounted by the Helm chart), a local
 * `npm run dev` falls back to `VITE_*` env, then to the testnet defaults below.
 * Kept separate from `config.ts` so the storage slice stays a self-contained
 * addition while decision #1 (revive the old app vs fold into this console) is
 * open.
 *
 * Defaults are the known-good **Dragon testnet** values (from ROC's `.env.stage`
 * and dragon-ansible's dragon1-testnet inventory) -- NOT ROC's code defaults,
 * which point at `*.cere.network` (a different network that 503s for Dragon
 * testnet). A real deploy overrides all of these per env via the Helm chart.
 *   - blockchainIndexUrl  bucket listing `GET /v1/buckets?owner=` (storage.testnet.dragon-1.xyz)
 *   - ddcS3GatewayUrl     upload/download/ACL via the S3 gateway (compute.test gateway)
 *   - ddcCdnUrl           public read-back (cdn.testnet.dragon-1.xyz)
 *   - clusterId           createBucket + deposit target (the Dragon testnet cluster)
 * The blockchain WS endpoint is NOT configured here: SDK v3 `connect({ network })`
 * resolves it from `network` (shared with config.ts).
 */

const env = import.meta.env;
const trim = (v: string) => v.replace(/\/$/, '');
const runtime = (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__) || {};
const pick = (key: keyof NonNullable<RuntimeConfig['storage']>, fromEnv: string | undefined, fallback: string) =>
  (runtime.storage?.[key] as string | undefined) || fromEnv || fallback;

export const storageConfig = {
  /** Blockchain index: `GET /v1/buckets?owner=` (see ddc/ownerBuckets.ts). */
  blockchainIndexUrl: trim(
    pick('blockchainIndexUrl', env.VITE_BLOCKCHAIN_INDEX_URL, 'https://storage.testnet.dragon-1.xyz'),
  ),
  /** DDC S3 gateway: bucket object upload/download and ACL (see ddc/bucketStorage.ts). */
  ddcS3GatewayUrl: trim(
    pick('ddcS3GatewayUrl', env.VITE_DDC_S3_GATEWAY_URL, 'https://ddc-s3-gateway.compute.test.ddcdragon.com'),
  ),
  /** Public CDN read-back for public-read objects. */
  ddcCdnUrl: trim(pick('ddcCdnUrl', env.VITE_DDC_CDN_URL, 'https://cdn.testnet.dragon-1.xyz')),
  /** Cluster the console creates buckets in / deposits to (Dragon testnet). */
  clusterId: pick('clusterId', env.VITE_DDC_CLUSTER_ID, '0x825c4b2352850de9986d9d28568db6f0c023a1e3'),
};

export type StorageConfig = typeof storageConfig;
