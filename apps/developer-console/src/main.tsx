import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@cere/cere-design-system/fonts/human-sans.css';
import '@cere/cere-design-system/tokens.css';
import './styles/tokens.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
