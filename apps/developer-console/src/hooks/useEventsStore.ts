import { useAppStore } from '~/hooks/useAppStore.ts';

export const useEventsStore = () => {
  const appStore = useAppStore();

  return appStore.eventsStore;
};
