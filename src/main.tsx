import ReactDOM from 'react-dom/client';

import Reporting from '~/reporting';
import App from './App';

Reporting.init();
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
