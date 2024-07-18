import { createTheme as createMuiTheme } from '@mui/material';

export type ThemeOptions = {
  // Add your theme options here
};

export const createTheme = () =>
  createMuiTheme({
    palette: {
      primary: {
        main: '#5865F2',
      },
    },

    typography: {
      fontWeightMedium: 500,

      subtitle1: {
        fontWeight: 500,
      },
    },
  });
