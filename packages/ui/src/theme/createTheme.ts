import '@mui/lab/themeAugmentation';
import { createTheme as createMuiTheme } from '@mui/material';

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    h5: false;
    h6: false;
  }
}

declare module '@mui/material/Card' {
  interface CardOwnProps {
    size?: 'small' | 'large';
  }
}

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

      h1: {
        fontSize: '2rem', // 32px
        lineHeight: '2.5rem', // 40px
        fontWeight: 700,
      },

      h2: {
        fontSize: '1.75rem', // 28px
        lineHeight: '2.25rem', // 36px
        fontWeight: 700,
      },

      h3: {
        fontSize: '1.5rem', // 24px,
        lineHeight: '2rem', // 32px,
        fontWeight: 600,
      },

      h4: {
        fontSize: '1.25rem', // 20px,
        lineHeight: '1.625rem', // 26px,
        fontWeight: 500,
      },

      subtitle1: {
        fontSize: '1rem', // 16px,
        lineHeight: '1.5rem', // 24px,
        fontWeight: 600,
      },

      subtitle2: {
        fontSize: '0.875rem', // 14px,
        lineHeight: '1.375rem', // 14px,
        fontWeight: 600,
      },

      body1: {
        fontSize: '1rem', // 16px,
        lineHeight: '1.5rem', // 24px,
      },

      body2: {
        fontSize: '0.875rem', // 14px,
        lineHeight: '1.375rem', // 14px,
      },

      caption: {
        fontSize: '0.75rem', // 12px,
        lineHeight: '1rem', // 16px,
      },

      button: {
        textTransform: 'none',
        fontWeight: '600',
      },
    },

    components: {
      MuiPaper: {
        defaultProps: {
          variant: 'outlined',
        },
      },

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

        styleOverrides: {
          root: ({ theme, ownerState }) => ({
            ...(ownerState.size === 'small' && {
              ['& .MuiCardHeader-root']: {
                ...theme.typography.body2,

                padding: theme.spacing(1.5, 1.5, 0.5),
                color: theme.palette.text.secondary,
              },

              ['& .MuiCardHeader-action']: {
                paddingRight: theme.spacing(1),
                alignSelf: 'center',
              },

              ['& .MuiCardHeader-avatar']: {
                marginRight: theme.spacing(1),

                ['& .MuiSvgIcon-root']: {
                  fontSize: theme.typography.pxToRem(22),
                },
              },

              ['& .MuiCardHeader-title']: {
                fontSize: theme.typography.body2.fontSize,
              },

              ['& .MuiCardContent-root']: {
                padding: theme.spacing(0.5, 1.5),

                '&:last-child': {
                  paddingBottom: theme.spacing(1),
                },
              },

              ['& .MuiCardActions-root']: {
                padding: theme.spacing(0.5, 1.5, 1.5),
              },
            }),

            ...(ownerState.size === 'large' && {
              ['& .MuiCardHeader-avatar .MuiSvgIcon-root']: {
                fontSize: theme.typography.pxToRem(60),
              },

              ['& .MuiCardHeader-title']: {
                ...theme.typography.h3,
              },

              ['& .MuiCardHeader-subheader']: {
                ...theme.typography.body1,
                color: theme.palette.text.primary,
              },
            }),
          }),
        },
      },

      MuiCardHeader: {
        defaultProps: {
          titleTypographyProps: {
            variant: 'body1',
          },

          subheaderTypographyProps: {
            variant: 'body2',
          },
        },

        styleOverrides: {
          action: {
            alignSelf: 'center',
          },
        },
      },

      MuiSelect: {
        defaultProps: {
          MenuProps: {
            anchorOrigin: {
              horizontal: 'right',
              vertical: 'bottom',
            },

            transformOrigin: {
              vertical: -8,
              horizontal: 'right',
            },
          },
        },
      },
    },
  });
