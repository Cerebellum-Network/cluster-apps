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

      secondary: {
        main: '#969696',
        contrastText: '#1D1B20',
      },

      background: {
        default: '#F5F7FA',
      },

      text: {
        primary: '#1D1B20',
        secondary: '#818083',
      },
    },

    shape: {
      borderRadius: 8,
    },

    typography: {
      fontWeightMedium: 500,

      subtitle1: {
        fontWeight: 600,
      },

      button: {
        textTransform: 'none',
        fontWeight: '600',
      },
    },

    components: {
      MuiButton: {
        defaultProps: {
          variant: 'contained',
          disableElevation: true,
        },

        styleOverrides: {
          outlined: ({ ownerState, theme }) => ({
            ...(ownerState.color === 'secondary' && {
              color: theme.palette.text.primary,
            }),
          }),
        },
      },

      MuiCard: {
        defaultProps: {
          variant: 'outlined',
        },
      },

      MuiCardHeader: {
        defaultProps: {
          titleTypographyProps: {
            variant: 'body2',
          },
        },

        styleOverrides: {
          root: ({ theme }) => ({
            padding: theme.spacing(1.5, 1.5, 0.5),
            color: theme.palette.text.secondary,
            fontSize: theme.typography.body2.fontSize,
          }),

          avatar: ({ theme }) => ({
            marginRight: theme.spacing(1),
          }),

          action: ({ theme }) => ({
            paddingRight: theme.spacing(1),
            alignSelf: 'center',
          }),
        },
      },

      MuiCardContent: {
        styleOverrides: {
          root: ({ theme }) => ({
            padding: theme.spacing(0.5, 1.5),

            '&:last-child': {
              paddingBottom: theme.spacing(1),
            },
          }),
        },
      },

      MuiCardActions: {
        styleOverrides: {
          root: ({ theme }) => ({
            padding: theme.spacing(0.5, 1.5, 1.5),
          }),
        },
      },
    },
  });
