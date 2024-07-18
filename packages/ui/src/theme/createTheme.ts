import { createTheme as createMuiTheme } from '@mui/material';

export type ThemeOptions = {
  // Add your theme options here
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- We need to keep the options parameter for future use
export const createTheme = (_options: ThemeOptions = {}) =>
  createMuiTheme({
    palette: {
      primary: {
        main: '#5865F2',
      },

      background: {
        default: '#F5F7FA',
      },
    },

    shape: {
      borderRadius: 8,
    },

    typography: {
      fontWeightMedium: 500,

      subtitle1: {
        fontWeight: 500,
      },

      button: {
        textTransform: 'none',
        fontWeight: '500',
      },
    },
  });
