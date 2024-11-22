import { useState } from 'react';

import { ErrorBoundary } from '@cluster-apps/reporting';
import { Provider as UIProvider, OnboardingProvider } from '@cluster-apps/ui';

import { Router } from './routes';
import { AppStore } from './stores';
import { AppStoreContext } from './hooks';
import { ApplicationTourProvider } from '~/components/ApplicationTour';

const App = () => {
  const [store] = useState(() => new AppStore());

  return (
    <UIProvider>
      <ErrorBoundary>
        <AppStoreContext.Provider value={store}>
          <ApplicationTourProvider>
            <OnboardingProvider>
              <Router />
            </OnboardingProvider>
          </ApplicationTourProvider>
        </AppStoreContext.Provider>
      </ErrorBoundary>
    </UIProvider>
  );
};

export default App;
