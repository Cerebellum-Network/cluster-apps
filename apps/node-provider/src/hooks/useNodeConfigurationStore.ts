import { useAppStore } from './useAppStore';

export const useNodeConfigurationStore = () => {
  const appStore = useAppStore();

  return appStore.nodeConfigurationStore;
};
