import { fromResource } from 'mobx-utils';
import { WalletAccount } from '@cere/embed-wallet';
import { IndexerApi, StatsApi } from '@cluster-apps/api';

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
    async () => {
      if (!account.address) {
        return undefined;
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

      return { total, history } as AccountMetrics;
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
      return undefined;
    }

    try {
      const indexerAccount = await api.getAccount(account.address);

      if (indexerAccount.exists) {
        console.log('[createAccountResource] Account loaded:', {
          exists: indexerAccount.exists,
          bucketsCount: indexerAccount.buckets?.length || 0,
        });
        return indexerAccount;
      }

      return undefined;
    } catch (error) {
      console.warn('[createAccountResource] Error loading account:', error);
      return undefined;
    }
  });
};

export const createClusterAccountResource = (account: AccountStore) => {
  const api = new IndexerApi();

  return createPullResource(async () => {
    if (!account.address) {
      return undefined;
    }

    try {
      const clusterAccount = await api.getAccountForCluster(account.address, DDC_CLUSTER_ID);

      if (clusterAccount.exists) {
        console.log('[createClusterAccountResource] Cluster account loaded:', {
          exists: clusterAccount.exists,
          bucketsCount: clusterAccount.buckets?.length || 0,
        });
      }

      return clusterAccount;
    } catch (error) {
      console.warn('[createClusterAccountResource] Error loading cluster account:', error);
      return undefined;
    }
  });
};
