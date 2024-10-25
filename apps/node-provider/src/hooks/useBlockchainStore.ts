import { ReadyAccount } from '~/stores';
import { useAppStore } from './useAppStore.ts';

export const useDdcBlockchainStore = (): ReadyAccount => {
  const appStore = useAppStore();

  // @ts-expect-error: ddcBlockchainStore ReadyAccount
  return appStore.ddcBlockchainStore;
};
