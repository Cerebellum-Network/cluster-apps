import ReactDOM from 'react-dom/client';
import Analytics from '@cluster-apps/analytics';
import Reporting from '@cluster-apps/reporting';

import App from './App';
import { APP_ENV, APP_VERSION } from './constants';
// Models slice design tokens (--b-* vars + fonts); scoped to the Models page's
// own look (ROC style, per the brief). Pure variable defs -- inert for the
// storage pages, which use the @cluster-apps/ui (MUI) theme.
import './styles/tokens.css';

Analytics.init();
Reporting.init({
  appVersion: APP_VERSION,
  environment: APP_ENV,
});

console.log('App version:', APP_VERSION);

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
