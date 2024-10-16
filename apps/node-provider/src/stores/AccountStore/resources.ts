import { fromResource } from 'mobx-utils';
import { WalletAccount } from '@cere/embed-wallet';
import { IndexerApi, StatsApi } from '@cluster-apps/api';

import type { AccountStore } from './AccountStore';
import type { AccountStatus, AccountMetrics } from './types';
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

  return createPullResource(() => (!account.address ? undefined : api.getAccount(account.address)));
};

export const createDdcNodesResource = (account: AccountStore) => {
  const api = new IndexerApi();

  return createPullResource(() => (!account.address ? undefined : api.getDdcNodes(account.address)));
};
