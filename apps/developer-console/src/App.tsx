import { useState } from 'react';

import { ErrorBoundary } from '@cluster-apps/reporting';
import { Provider as UIProvider, OnboardingProvider } from '@cluster-apps/ui';
import { ThemeProvider } from '@mui/material';

import { Router } from './routes';
import { AppStore } from './stores';
import { AppStoreContext } from './hooks';
import { ApplicationTourProvider } from '~/components/ApplicationTour';
import { SessionProvider } from '~/wallet/session';
import { SessionBridge } from '~/wallet/SessionBridge';
import { developerConsoleTheme } from '~/theme';
import '~/theme/theme.css';

const App = () => {
  const [store] = useState(() => new AppStore());

  return (
    <UIProvider>
      {/* Local redesign theme, layered on the shared @cluster-apps/ui theme. */}
      <ThemeProvider theme={developerConsoleTheme}>
        <div className="dc-root">
          <ErrorBoundary>
            <AppStoreContext.Provider value={store}>
              <SessionProvider>
                <SessionBridge />
                <ApplicationTourProvider>
                  <OnboardingProvider>
                    <Router />
                  </OnboardingProvider>
                </ApplicationTourProvider>
              </SessionProvider>
            </AppStoreContext.Provider>
          </ErrorBoundary>
        </div>
      </ThemeProvider>
    </UIProvider>
  );
};

export default App;
