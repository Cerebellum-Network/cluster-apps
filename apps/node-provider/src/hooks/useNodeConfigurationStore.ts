import { ReadyAccount } from '~/stores';
import { useAppStore } from './useAppStore';

export const useNodeConfigurationStore = (): ReadyAccount => {
  const appStore = useAppStore();

  return appStore.nodeConfigurationStore;
};
