import { PropsWithChildren, useMemo } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';

import { createTheme, ThemeOptions } from './theme';
import { MessagesProvider } from './hooks';

export type ProviderProps = PropsWithChildren<{
  options?: ThemeOptions;
}>;

export const Provider = ({ children, options }: ProviderProps) => {
  const theme = useMemo(() => createTheme(options), [options]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MessagesProvider>{children}</MessagesProvider>
    </ThemeProvider>
  );
};
