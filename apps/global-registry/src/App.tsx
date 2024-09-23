import { useState } from 'react';
import { Provider as UIProvider } from '@cluster-apps/ui';
import { ErrorBoundary } from '@cluster-apps/reporting';

import { Router } from './routes';
import { AppStore } from './stores';
import { AppStoreContext } from './hooks';

const App = () => {
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

export default App;
