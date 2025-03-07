import { fromResource } from 'mobx-utils';
import { WalletAccount } from '@cere/embed-wallet';
import { IndexerApi, StatsApi, AccountStats } from '@cluster-apps/api';
import { DDC_PRESET } from '~/constants';

import type { AccountStore } from './AccountStore';
import type { AccountStatus, AccountMetrics } from './types';
import { createPullResource } from './createPullResource';
import Reporting from '@cluster-apps/reporting';

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

  return fromResource<string | undefined>(
    async (sink) => {
      // Only get the Cere mainnet account
      const handler = (accounts: WalletAccount[]) => {
        // Find the Cere account (not Ethereum)
        const cereAccount = accounts.find(account => account?.address?.startsWith('6'));
        sink(cereAccount?.address);
      };

      wallet
        .getAccounts()
        .then(handler)
        .catch(() => handler([]));

      unsubscribe = wallet.subscribe('accounts-update', handler);
    },
    unsubscribe,
    undefined,
  );
};

export const createBucketStatsResource = (account: AccountStore) => {
  const api = new StatsApi();
  const bucketIds = account.buckets?.map(({ id }) => id) ?? [];

  return createPullResource(async () => {
    try {
      return await api.getBucketsStats(bucketIds);
    } catch (error) {
      console.error('Failed to fetch bucket stats:', error);
      return [];
    }
  }, {
    pullTimeout: 60_000, // 1 minute
  });
};

export const createAccountMetricsResource = (account: AccountStore) => {
  const api = new StatsApi();

  return createPullResource(async () => {
    if (!account.address) {
      return undefined;
    }

    try {
      const from = new Date();
      from.setMonth(from.getMonth() - 1);

      const [total, history] = await Promise.all([
        api.getAccountStats(account.address),
        api.getAccountStatsHistory(account.address, { from }),
      ]);

      return { total, history } as AccountMetrics;
    } catch (error) {
      console.error('Failed to fetch account metrics:', error);
      Reporting.message('Failed to fetch account metrics', 'error', { error });
      
      // Create default metrics with the correct type structure
      const defaultStats: AccountStats = {
        address: account.address,
        storedBytes: 0,
        transferredBytes: 0,
        puts: 0,
        gets: 0
      };
      
      return {
        total: defaultStats,
        history: []
      } as AccountMetrics;
    }
  }, {
    pullTimeout: 10000, // 10 seconds
  });
};

export const createAccountResource = (account: AccountStore) => {
  const api = new IndexerApi();
  
  return createPullResource(async () => {
    if (!account.address) {
      console.log('No account address available');
      return undefined;
    }
    
    try {
      console.log('Fetching account data for Cere mainnet address:', account.address);
      const accountData = await api.getAccount(account.address);
      console.log('Account data received from mainnet:', accountData);
      console.log('Balance:', accountData.balance.toString(), 'Deposit:', accountData.deposit.toString());
      
      // Ensure we have proper BigInt values
      return {
        ...accountData,
        balance: BigInt(accountData.balance || 0),
        deposit: BigInt(accountData.deposit || 0),
        buckets: accountData.buckets || [],
      };
    } catch (error) {
      console.error('Failed to fetch account from mainnet:', error);
      Reporting.message('Failed to fetch account data from mainnet', 'error', { error });
      return {
        balance: 0n,
        deposit: 0n,
        buckets: [],
      };
    }
  }, {
    pullTimeout: 10000, // 10 seconds
  });
};
