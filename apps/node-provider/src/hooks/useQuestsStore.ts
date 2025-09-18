import { useAppStore } from './useAppStore';

export const useQuestsStore = () => {
  const appStore = useAppStore();

  return appStore.questsStore;
};
