import ReactDOM from 'react-dom/client';

import { APP_VERSION } from './constants';
import App from './App';

console.log('App version:', APP_VERSION);

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
