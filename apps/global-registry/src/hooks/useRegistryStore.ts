import { useAppStore } from './useAppStore';

export const useRegistryStore = () => {
  const appStore = useAppStore();

  return appStore.registryStore;
};
