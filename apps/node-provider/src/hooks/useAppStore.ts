import { createContext, useContext } from 'react';
import type { AppStore } from '~/stores';

export const AppStoreContext = createContext<AppStore | null>(null);

export const useAppStore = () => {
  const appStore = useContext(AppStoreContext);

  if (!appStore) {
    throw new Error('Not in the app context');
  }

  return appStore;
};
