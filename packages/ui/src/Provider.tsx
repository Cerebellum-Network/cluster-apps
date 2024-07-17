import { PropsWithChildren, useMemo } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';

import { createTheme, ThemeOptions } from './theme';

export type ProviderProps = PropsWithChildren<{
  options?: ThemeOptions;
}>;

export const Provider = ({ children, options }: ProviderProps) => {
  const theme = useMemo(() => createTheme(options), [options]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
};
