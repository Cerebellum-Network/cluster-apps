import { PropsWithChildren, useMemo } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { isMobile } from 'react-device-detect';

import { createTheme, ThemeOptions } from './theme';
import { MessagesProvider } from './hooks';
import { MobileOverlay } from './components';

export type ProviderProps = PropsWithChildren<{
  options?: ThemeOptions;
}>;

export const Provider = ({ children, options }: ProviderProps) => {
  const theme = useMemo(() => createTheme(options), [options]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {isMobile ? <MobileOverlay /> : <MessagesProvider>{children}</MessagesProvider>}
    </ThemeProvider>
  );
};
