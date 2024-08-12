import { useAppStore } from './useAppStore';

export const useContentStorageStore = () => {
  const appStore = useAppStore();

  return appStore.contentStorageStore;
};
