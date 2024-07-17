import { createTheme as createMuiTheme } from '@mui/material';

export type ThemeOptions = {
  // Add your theme options here
};

export const createTheme = (options: ThemeOptions = {}) => createMuiTheme({ ...options });
