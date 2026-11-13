/**
 * Storage-slice runtime configuration.
 *
 * Same pattern as the app's `src/config.ts`: a deployed build reads these from
 * `/config.js` (`window.__RUNTIME_CONFIG__`, mounted by the Helm chart), a local
 * `npm run dev` falls back to `VITE_*` env, then to the testnet defaults below.
 *
 * Defaults are the known-good **Dragon testnet** values (from the dragon-ansible
 * dragon1-testnet inventory). A real deploy overrides all of these per env via
 * the Helm chart.
 *   - blockchainIndexUrl  bucket listing `GET /v1/buckets?owner=` (storage.testnet.dragon-1.xyz)
 *   - ddcS3GatewayUrl     upload/download/ACL via the S3 gateway (compute.test gateway)
 *   - ddcCdnUrl           public read-back (cdn.testnet.dragon-1.xyz)
 *   - clusterId           createBucket + deposit target (the Dragon testnet cluster)
 * The blockchain WS endpoint is NOT configured here: SDK v3 `connect({ network })`
 * resolves it from `network` (shared with config.ts).
 */

const env = import.meta.env;
/**
 * Runtime storage shape, declared locally rather than reading the app-wide
 * ambient `RuntimeConfig` (src/vite-env.d.ts). Keeping it self-contained lets
 * this module compile in a consumer that does not include dev-console's ambient
 * types -- node-provider imports `DDC_CLUSTER_ID` from `constants.ts`, which
 * pulls this file into its `tsc` without dev-console's `vite-env.d.ts`.
 */
type StorageRuntime = {
  blockchainIndexUrl?: string;
  ddcS3GatewayUrl?: string;
  ddcCdnUrl?: string;
  clusterId?: string;
  statsEndpoint?: string;
};

const trim = (v: string) => v.replace(/\/$/, '');
const runtime =
  (typeof window !== 'undefined' &&
    (window as { __RUNTIME_CONFIG__?: { storage?: StorageRuntime } }).__RUNTIME_CONFIG__) ||
  {};
const pick = (key: keyof StorageRuntime, fromEnv: string | undefined, fallback: string) =>
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
  /**
   * DAC statistics HTTP API (`GET /statistics/*`) for per-bucket / per-account
   * storage usage. Empty by default: there is no known-good Dragon-1 host yet,
   * so the usage view hides itself. Set it (env/Helm) once ops confirm the host.
   */
  statsEndpoint: trim(pick('statsEndpoint', env.VITE_STATS_ENDPOINT, '')),
};

export type StorageConfig = typeof storageConfig;
