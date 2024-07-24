import { STATS_ENDPOINT } from '../constants';

export type BucketStats = {
  bucketId: bigint;
  storedBytes: number;
  transferredBytes: number;
  puts: number;
  gets: number;
};

export class StatsApi {
  private baseUrl = STATS_ENDPOINT;

  getBucketsStats = async (bucketIds: bigint[]) => {
    const url = new URL('/statistics/buckets', this.baseUrl);

    if (bucketIds.length) {
      url.searchParams.append('bucketIds', bucketIds.join(','));
    }

    const response = await fetch(url);
    const { data } = await response.json();
    const stats: BucketStats[] = data;

    return stats.map((stat) => ({
      ...stat,
      bucketId: BigInt(stat.bucketId),
    }));
  };
}
