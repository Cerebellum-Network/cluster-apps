import { useAppStore } from './useAppStore';

export const useAccountStore = () => {
  const appStore = useAppStore();

  return appStore.accountStore;
};
