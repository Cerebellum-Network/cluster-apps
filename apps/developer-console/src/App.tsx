import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { darkTheme } from './theme';
import { Router as AppRoutes } from './routes';
import { WalletProvider } from './providers/WalletProvider';

const App: React.FC = () => {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <WalletProvider>
        <Router>
          <AppRoutes />
        </Router>
      </WalletProvider>
    </ThemeProvider>
  );
};

export default App;
