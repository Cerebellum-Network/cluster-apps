import '@mui/lab/themeAugmentation';
import { createTheme as createMuiTheme, PaletteMode } from '@mui/material';

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
  mode?: PaletteMode;
};

export const createTheme = (options: ThemeOptions = {}) => {
  const { mode = 'light' } = options;
  
  return createMuiTheme({
    palette: {
      mode,
      primary: {
        main: '#5865F2',
      },

      secondary: {
        main: '#969696',
        contrastText: mode === 'dark' ? '#ffffff' : '#1D1B20',
        light: mode === 'dark' ? '#2D2D30' : '#F5F6FF',
      },

      background: {
        default: mode === 'dark' ? '#1E1E1E' : '#F5F7FA',
        paper: mode === 'dark' ? '#252526' : '#FFFFFF',
      },

      divider: mode === 'dark' ? '#3E3E42' : '#E6E6E6',

      text: {
        primary: mode === 'dark' ? '#FFFFFF' : '#1D1B20',
        secondary: mode === 'dark' ? '#CCCCCC' : '#818083',
      },

      action: {
        selected: mode === 'dark' ? '#37373D' : '#F5F7FA',
        hover: mode === 'dark' ? '#2A2D2E' : '#F5F6FF',
      },
    },

    shape: {
      borderRadius: 8,
    },

    typography: {
      fontFamily: 'HumanSans, sans-serif',
      fontWeightMedium: 500,

      h1: {
        fontSize: '3rem', // 48px
        lineHeight: '2.5rem', // 40px
        fontWeight: 700,
      },

      h2: {
        fontSize: '2.125rem', // 34px
        lineHeight: '2.25rem', // 36px
        fontWeight: 700,
      },

      h3: {
        fontSize: '1.5rem', // 24px,
        lineHeight: '2rem', // 32px,
        fontWeight: 500,
      },

      h4: {
        fontSize: '1.25rem', // 20px,
        lineHeight: '1.625rem', // 26px,
        fontWeight: 500,
      },

      subtitle1: {
        fontSize: '1rem', // 16px,
        lineHeight: '1.5rem', // 24px,
        fontWeight: 500,
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
        fontWeight: 400,
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
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper,
            borderColor: theme.palette.divider,
          }),
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
          containedSecondary: {
            backgroundColor: '#000000',
            color: '#fff',
            '&:hover': {
              opacity: '30%',
            },
          },
        },
      },

      MuiCard: {
        defaultProps: {
          variant: 'outlined',
        },

        styleOverrides: {
          root: ({ theme, ownerState }) => ({
            backgroundColor: theme.palette.background.paper,
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
                ...theme.typography.h2,
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
            variant: 'subtitle1',
          },

          subheaderTypographyProps: {
            variant: 'body2',
          },
        },

        styleOverrides: {
          root: {
            alignItems: 'flex-start',
            padding: '1.5rem 2rem',
          },
          action: {
            alignSelf: 'center',
            margin: 0,
          },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: {
            padding: '1.25rem 2rem 0',
          },
        },
      },

      MuiSelect: {
        defaultProps: {
          MenuProps: {
            anchorOrigin: {
              vertical: 'bottom',
              horizontal: 'left',
            },
            transformOrigin: {
              vertical: 'top',
              horizontal: 'left',
            },
            PaperProps: {
              elevation: 2,
            },
          },
        },
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper,
          }),
        },
      },
      
      MuiMenu: {
        styleOverrides: {
          paper: ({ theme }) => ({
            backgroundColor: theme.palette.mode === 'dark' 
              ? theme.palette.background.paper 
              : '#fff',
            boxShadow: theme.palette.mode === 'dark' 
              ? '0px 5px 15px rgba(0, 0, 0, 0.5)' 
              : '0px 5px 15px rgba(0, 0, 0, 0.1)',
            borderRadius: theme.shape.borderRadius,
            border: `1px solid ${theme.palette.divider}`,
          }),
          list: ({ theme }) => ({
            padding: theme.spacing(1),
          }),
        },
      },
      
      MuiMenuItem: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: theme.shape.borderRadius / 2,
            margin: theme.spacing(0.25, 0),
            padding: theme.spacing(1, 1.5),
            '&:hover': {
              backgroundColor: theme.palette.mode === 'dark' 
                ? 'rgba(255, 255, 255, 0.08)' 
                : 'rgba(0, 0, 0, 0.04)',
            },
            '&.Mui-selected': {
              backgroundColor: theme.palette.mode === 'dark' 
                ? 'rgba(122, 159, 255, 0.15)' 
                : 'rgba(122, 159, 255, 0.1)',
              '&:hover': {
                backgroundColor: theme.palette.mode === 'dark' 
                  ? 'rgba(122, 159, 255, 0.25)' 
                  : 'rgba(122, 159, 255, 0.2)',
              },
            },
          }),
        },
      },
      
      MuiCssBaseline: {
        styleOverrides: (theme) => ({
          body: {
            scrollbarColor: theme.palette.mode === 'dark' 
              ? 'rgba(255, 255, 255, 0.2) rgba(0, 0, 0, 0.3)' 
              : 'rgba(0, 0, 0, 0.3) rgba(255, 255, 255, 0.2)',
            '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.2)',
              width: 8,
              height: 8,
              borderRadius: 4,
            },
            '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
              borderRadius: 4,
              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.3)',
              minHeight: 24,
            },
            '&::-webkit-scrollbar-thumb:focus, & *::-webkit-scrollbar-thumb:focus': {
              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.4)',
            },
            '&::-webkit-scrollbar-thumb:active, & *::-webkit-scrollbar-thumb:active': {
              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.4)',
            },
            '&::-webkit-scrollbar-thumb:hover, & *::-webkit-scrollbar-thumb:hover': {
              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.4)',
            },
          },
        }),
      },
    },
  });
};
