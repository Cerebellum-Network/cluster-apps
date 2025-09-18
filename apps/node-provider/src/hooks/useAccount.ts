import { ReadyAccount } from '~/stores';
import { useAccountStore } from './useAccountStore';

export const useAccount = (): ReadyAccount => {
  const account = useAccountStore();

  if (!account.isReady()) {
    throw new Error('Account is not ready');
  }

  return account;
};
