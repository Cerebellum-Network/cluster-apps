import { Provider as UIProvider } from '@cluster-apps/ui';
import { ErrorBoundary } from '@cluster-apps/reporting';
import { Router } from './routes';
import { AppStoreContext } from './hooks';
import { useState } from 'react';
import { AppStore } from './stores';

export const App = () => {
  const [store] = useState(() => new AppStore());
  return (
    <UIProvider>
      <ErrorBoundary>
        <AppStoreContext.Provider value={store}>
          <Router />
        </AppStoreContext.Provider>
      </ErrorBoundary>
    </UIProvider>
  );
};
