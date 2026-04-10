import { fromResource } from 'mobx-utils';
import { WalletAccount } from '@cere/embed-wallet';
import { IndexerApi, StatsApi } from '@cluster-apps/api';
import type { Bucket as BlockchainBucket } from '@cere-ddc-sdk/blockchain';
import { encodeAddress, decodeAddress } from '@cere-ddc-sdk/blockchain';
import Reporting from '@cluster-apps/reporting';

import { DDC_CLUSTER_ID } from '~/constants';
import type { AccountStore } from './AccountStore';
import type { AccountMetrics, AccountStatus } from './types';
import { createPullResource } from './createPullResource';

export const createStatusResource = ({ wallet }: AccountStore) => {
  let unsubscribe = () => {};

  return fromResource<AccountStatus>(
    (sink) => {
      sink(wallet.status);
      unsubscribe = wallet.subscribe('status-update', sink);
    },
    unsubscribe,
    'not-ready',
  );
};

export const createAddressResource = ({ wallet }: AccountStore) => {
  let unsubscribe = () => {};

  return fromResource<string>(async (sink) => {
    const handler = ([, cere]: WalletAccount[]) => sink(cere?.address);

    wallet
      .getAccounts()
      .then(handler)
      .catch(() => handler([]));

    unsubscribe = wallet.subscribe('accounts-update', handler);
  }, unsubscribe);
};

export const createBucketStatsResource = (account: AccountStore) => {
  const api = new StatsApi();
  const bucketIds = account.buckets?.map(({ id }) => id) ?? [];

  return createPullResource(() => api.getBucketsStats(bucketIds), {
    pullTimeout: 60_000, // 1 minute
  });
};

export const createAccountMetricsResource = (account: AccountStore) => {
  const api = new StatsApi();

  return createPullResource(
    async (): Promise<AccountMetrics | null> => {
      if (!account.address) {
        return null;
      }

      const from = new Date();

      /**
       * Get stats for the last month
       */
      from.setMonth(from.getMonth() - 1);

      const [total, history] = await Promise.all([
        api.getAccountStats(account.address),
        api.getAccountStatsHistory(account.address, { from }),
      ]);

      return { total, history };
    },
    {
      pullTimeout: 60_000, // 1 minute
    },
  );
};

export const createAccountResource = (account: AccountStore) => {
  const api = new IndexerApi();

  return createPullResource(async () => {
    if (!account.address) {
      return null;
    }

    try {
      return await api.getAccount(account.address);
    } catch (error) {
      return null;
    }
  });
};

export const createClusterAccountResource = (account: AccountStore) => {
  const api = new IndexerApi();

  return createPullResource(async () => {
    if (!account.address) {
      return null;
    }

    try {
      return await api.getAccountForCluster(account.address, DDC_CLUSTER_ID);
    } catch (error) {
      return null;
    }
  });
};

export const createBalanceResource = (account: AccountStore) => {
  return createPullResource(async (): Promise<null | bigint> => {
    if (!account.address) {
      return null;
    }

    return account.ddc.getBalance();
  });
};

export const createDepositResource = (account: AccountStore) => {
  return createPullResource(async (): Promise<bigint | null> => {
    if (!account.address) {
      return null;
    }

    return account.ddc.getDeposit(DDC_CLUSTER_ID);
  });
};

const BUCKET_CACHE_PREFIX = '@cluster-apps/buckets/';
const BUCKET_POLL_TIMEOUT = 60_000;

type CachedBucket = { id: string; isPublic: boolean; clusterId: string };

const normalizeCereAddress = (address: string): string => {
  try {
    return encodeAddress(decodeAddress(address));
  } catch {
    return address;
  }
};

const saveBucketsCache = (address: string, buckets: BlockchainBucket[]): void => {
  try {
    const serializable: CachedBucket[] = buckets.map(({ bucketId, isPublic, clusterId }) => ({
      id: bucketId.toString(),
      isPublic,
      clusterId,
    }));
    localStorage.setItem(`${BUCKET_CACHE_PREFIX}${address}`, JSON.stringify(serializable));
  } catch {
    // localStorage may be unavailable (private mode, quota exceeded)
  }
};

const loadBucketsCache = (address: string): BlockchainBucket[] | null => {
  try {
    const raw = localStorage.getItem(`${BUCKET_CACHE_PREFIX}${address}`);
    if (!raw) return null;
    const cached: CachedBucket[] = JSON.parse(raw);
    return cached.map(({ id, isPublic, clusterId }) => ({
      bucketId: BigInt(id),
      ownerId: address,
      clusterId: clusterId as `0x${string}`,
      isPublic,
      isRemoved: false,
    }));
  } catch {
    return null;
  }
};

export const createBucketListResource = (account: AccountStore, onFirstFetchDone?: () => void) => {
  const cached = account.address ? loadBucketsCache(account.address) : null;
  let timeout: ReturnType<typeof setTimeout>;
  let firstFetchDone = false;

  // If we have cached data, consider first fetch done immediately
  if (cached) {
    firstFetchDone = true;
    onFirstFetchDone?.();
  }

  const pull = async (): Promise<BlockchainBucket[] | null> => {
    if (!account.address) return null;

    const normalizedAddress = normalizeCereAddress(account.address);
    const allBuckets = await account.ddc.getBucketList();
    const owned = allBuckets.filter((bucket) => normalizeCereAddress(bucket.ownerId) === normalizedAddress);

    saveBucketsCache(account.address, owned);

    if (!firstFetchDone) {
      firstFetchDone = true;
      onFirstFetchDone?.();
    }

    return owned;
  };

  const start = async (sink: (value: BlockchainBucket[] | null) => void) => {
    await pull().then(sink).catch(Reporting.error);
    timeout = setTimeout(() => start(sink), BUCKET_POLL_TIMEOUT);
  };

  return fromResource<BlockchainBucket[] | null>(
    (sink) => {
      if (cached) {
        sink(cached);
      }
      void start(sink);
    },
    () => clearTimeout(timeout),
    cached,
  );
};
