import { STATS_ENDPOINT } from '../constants';

export type Stats = {
  storedBytes: number;
  transferredBytes: number;
  puts: number;
  gets: number;
};

export type BucketStats = Stats & {
  bucketId: bigint;
};

export type AccountStats = Stats & {
  address: string;
};

export type AccountStatsHistoryRecord = AccountStats & {
  recordTime: Date;
};

export type StatsHistoryFilter = {
  from: Date;
  to?: Date;
};

export class StatsApi {
  private baseUrl = STATS_ENDPOINT;

  getAccountStats = async (accountId: string) => {
    const url = new URL(`/statistics/accounts/${accountId}`, this.baseUrl);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch stats for account ${accountId}`);
    }

    const data = await response.json();

    return data as AccountStats;
  };

  getAccountStatsHistory = async (accountId: string, { from, to }: StatsHistoryFilter) => {
    const url = new URL(`/statistics/accounts/${accountId}/history`, this.baseUrl);

    url.searchParams.append('from', from.toISOString());

    if (to) {
      url.searchParams.append('to', to.toISOString());
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch stats history for account ${accountId}`);
    }

    const history: AccountStatsHistoryRecord[] = await response.json();

    return history.map((record: AccountStatsHistoryRecord) => ({
      ...record,
      recordTime: new Date(record.recordTime),
    }));
  };

  getBucketsStats = async (bucketIds: bigint[]) => {
    if (bucketIds.length === 0) {
      return [];
    }

    const url = new URL('/statistics/buckets', this.baseUrl);

    if (bucketIds.length) {
      url.searchParams.append('bucketIds', bucketIds.join(','));
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch stats for buckets: ${bucketIds.join(', ')}`);
    }

    const stats: BucketStats[] = await response.json();

    return stats.map((stat) => ({
      ...stat,
      bucketId: BigInt(stat.bucketId),
    }));
  };
}
