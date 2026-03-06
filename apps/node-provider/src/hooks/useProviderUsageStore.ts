import { useAppStore } from './useAppStore';

export const useProviderUsageStore = () => {
  return useAppStore().providerUsageStore;
};
