import { useState } from 'react';
import { ErrorBoundary } from '@cluster-apps/reporting';
import { Provider as UIProvider, OnboardingProvider } from '@cluster-apps/ui';

import { Router } from './routes';
import { AppStore } from './stores';
import { AppStoreContext } from './hooks';

const App = () => {
  const [store] = useState(() => new AppStore());

  return (
    <UIProvider>
      <ErrorBoundary>
        <AppStoreContext.Provider value={store}>
          <OnboardingProvider>
            <Router />
          </OnboardingProvider>
        </AppStoreContext.Provider>
      </ErrorBoundary>
    </UIProvider>
  );
};

export default App;
