import { useAppStore } from './useAppStore';

export const usePaymentHistoryStore = () => {
  const appStore = useAppStore();

  return appStore.paymentsStore;
};
