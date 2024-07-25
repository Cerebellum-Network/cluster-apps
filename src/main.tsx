import ReactDOM from 'react-dom/client';
import Analytics from '@developer-console/analytics';
import Reporting from '@developer-console/reporting';

import App from './App';
import { APP_ENV, APP_VERSION } from './constants';

Analytics.init();
Reporting.init({
  appVersion: APP_VERSION,
  environment: APP_ENV,
});

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
