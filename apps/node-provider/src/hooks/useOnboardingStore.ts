import { useAppStore } from './useAppStore';

export const useOnboardingStore = () => {
  const appStore = useAppStore();

  return appStore.onboardingStore;
};
