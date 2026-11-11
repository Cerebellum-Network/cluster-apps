/**
 * DAC statistics HTTP API client (storage usage).
 *
 * Ported from ROC's `src/features/account/api/statsApi.ts`: the DAC exposes a
 * public, no-auth `GET /statistics/*` surface that returns per-bucket and
 * per-account storage usage (stored bytes, transferred bytes, PUT/GET counts) --
 * the "activity/metrics" source for the Developer Console's usage view, and NOT
 * the reconciliation-service (that is the Manykind boundary).
 *
 * The base URL is `storageConfig.statsEndpoint`, which is EMPTY until ops confirm
 * a live Dragon-1 host (see storageConfig.ts). Callers must treat an unset
 * endpoint as "usage unavailable" rather than calling here; `statsConfigured`
 * is the guard.
 */
import { storageConfig } from '../storageConfig';

export interface Stats {
  storedBytes: number;
  transferredBytes: number;
  puts: number;
  gets: number;
}
export interface BucketStats extends Stats {
  bucketId: bigint;
}

/** True once a DAC stats endpoint is configured; the usage view gates on this. */
export const statsConfigured = (): boolean => storageConfig.statsEndpoint !== '';

function base(): string {
  if (!storageConfig.statsEndpoint) throw new Error('No DAC stats endpoint configured for this network.');
  return storageConfig.statsEndpoint;
}

/** Per-bucket usage for a set of chain bucket ids. Empty input → no request. */
export async function getBucketsStats(bucketIds: bigint[]): Promise<BucketStats[]> {
  if (bucketIds.length === 0) return [];
  const url = new URL('/statistics/buckets', base());
  url.searchParams.set('bucketIds', bucketIds.join(','));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load bucket usage: ${res.status}`);
  const stats = (await res.json()) as BucketStats[];
  return stats.map((s) => ({ ...s, bucketId: BigInt(s.bucketId) }));
}
