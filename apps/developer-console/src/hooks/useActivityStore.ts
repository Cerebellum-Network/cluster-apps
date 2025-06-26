import { useContext } from 'react';
import { AppStoreContext } from './useAppStore';

export const useActivityStore = () => {
  const appStore = useContext(AppStoreContext);

  if (!appStore) {
    throw new Error('AppStore context not found');
  }

  return appStore.activityStore;
};
