import { fromResource } from 'mobx-utils';
import { WalletAccount } from '@cere/embed-wallet';
import { IndexerApi } from '@developer-console/api';

import { CERE_DECIMALS } from '~/constants';
import type { AccountStore } from './AccountStore';
import type { AccountStatus } from './types';
import { createPullResource } from './createPullResource';

export const createStatusResource = ({ wallet }: AccountStore) => {
  let unsubscribe = () => {};

  return fromResource<AccountStatus>(
    (sink) => {
      unsubscribe = wallet.subscribe('status-update', sink);
    },
    unsubscribe,
    'not-ready',
  );
};

export const createAddressResource = ({ wallet }: AccountStore) => {
  let unsubscribe = () => {};

  return fromResource<string>((sink) => {
    unsubscribe = wallet.subscribe('accounts-update', ([, cere]: WalletAccount[]) => sink(cere?.address));
  }, unsubscribe);
};

export const createBalanceResource = (account: AccountStore) =>
  createPullResource(async () => {
    const deposit = await account.ddc?.getBalance();

    return deposit !== undefined ? Number(deposit / BigInt(10 ** CERE_DECIMALS)) : undefined;
  });

export const createDepositResource = (account: AccountStore) =>
  createPullResource(async () => {
    const deposit = await account.ddc?.getDeposit();

    return deposit !== undefined ? Number(deposit / BigInt(10 ** CERE_DECIMALS)) : undefined;
  });

export const createBucketsResource = (account: AccountStore) => {
  const api = new IndexerApi();

  return createPullResource(() => (account.address ? api.getBuckets(account.address) : undefined));
};
