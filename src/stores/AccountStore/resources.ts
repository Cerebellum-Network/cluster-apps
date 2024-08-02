import { fromResource } from 'mobx-utils';
import { WalletAccount } from '@cere/embed-wallet';
import { IndexerApi } from '@developer-console/api';

import type { AccountStore } from './AccountStore';
import type { AccountStatus } from './types';
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

export const createAccountResource = (account: AccountStore) => {
  const api = new IndexerApi();

  return createPullResource(() => (!account.address ? undefined : api.getAccount(account.address)));
};
