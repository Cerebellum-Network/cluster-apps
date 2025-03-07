import { PropsWithChildren, useMemo } from 'react';
import { CssBaseline, ThemeProvider as MuiThemeProvider } from '@mui/material';

import { createTheme, ThemeOptions, ThemeProvider as CustomThemeProvider, useThemeContext } from './theme';
import { MessagesProvider } from './hooks';

export type ProviderProps = PropsWithChildren<{
  options?: ThemeOptions;
}>;

const ThemedApp = ({ children, options }: ProviderProps) => {
  const { mode } = useThemeContext();
  const theme = useMemo(() => createTheme({ ...options, mode }), [options, mode]);

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <MessagesProvider>{children}</MessagesProvider>
    </MuiThemeProvider>
  );
};

export const Provider = ({ children, options }: ProviderProps) => {
  return (
    <CustomThemeProvider>
      <ThemedApp options={options}>{children}</ThemedApp>
    </CustomThemeProvider>
  );
};
