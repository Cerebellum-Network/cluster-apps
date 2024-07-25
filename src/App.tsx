import { useState } from 'react';
import { Provider as UIProvider } from '@developer-console/ui';

import { Router } from './routes';
import { AppStore } from './stores';
import { AppStoreContext } from './hooks';
import { ErrorBoundary } from '@developer-console/reporting';

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
