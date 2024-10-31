import { useAppStore } from './useAppStore.ts';

export const useDdcBlockchainStore = () => {
  const appStore = useAppStore();

  return appStore.ddcBlockchainStore;
};
