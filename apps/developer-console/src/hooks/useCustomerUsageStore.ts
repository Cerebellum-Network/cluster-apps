import { useAppStore } from './useAppStore';

export const useCustomerUsageStore = () => {
  const appStore = useAppStore();

  return appStore.customerUsageStore;
};
