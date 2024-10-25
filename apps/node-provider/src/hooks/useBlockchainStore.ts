import { ReadyAccount } from '~/stores';
import { useAppStore } from './useAppStore.ts';

export const useDdcBlockchainStore = (): ReadyAccount => {
  const appStore = useAppStore();

  // @ts-ignore
  return appStore.ddcBlockchainStore;
};
