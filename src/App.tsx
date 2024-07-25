import { useState } from 'react';
import { Provider as UIProvider } from '@developer-console/ui';

import { Router } from './routes';
import { AppStore } from './stores';
import { AppStoreContext } from './hooks';

const App = () => {
  const [store] = useState(() => new AppStore());

  return (
    <UIProvider>
      <AppStoreContext.Provider value={store}>
        <Router />
      </AppStoreContext.Provider>
    </UIProvider>
  );
};

export default App;
