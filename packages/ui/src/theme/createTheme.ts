import { createTheme as createMuiTheme } from '@mui/material';
import colors from '../styles/colors.tsx';

const themeParams = {
  primaryMainColor: colors.primaryDark,
  primaryLightColor: colors.light,
  secondaryMainColor: colors.accent,
  secondaryDarkColor: colors.accentDark,
  // buttonContainedPrimaryFirstColor: appConfig.buttonContainedPrimaryFirstColor || colors.accent,
  // buttonContainedPrimarySecondColor: appConfig.buttonContainedPrimarySecondColor || colors.buttonSecondary,
  // buttonContainedSecondaryColor: appConfig.buttonContainedSecondaryColor || colors.primaryDark,
  infoMainColor: colors.cyan,
  backgroundPaperColor: colors.snowWhite,
  backgroundDefaultColor: colors.white,
  grey100Color: colors.footer,
  grey700Color: colors.lightGrey,
  purple: colors.purple,
};

export type ThemeOptions = {
  // Add your theme options here
};

export const createTheme = (options: ThemeOptions = {}) =>
  createMuiTheme({
    typography: {
      fontFamily: 'HumanSans, Inter, Roboto, Helvetica, Arial, sans-serif',
      h1: {
        fontSize: '28px',
        fontWeight: 700,
        fontStyle: 'normal',
        lineHeight: '42px',
      },
      h2: {
        fontSize: '24px',
        fontWeight: 700,
        fontStyle: 'normal',
        lineHeight: '36px',
      },
      h3: {
        fontSize: '20px',
        fontWeight: 500,
        fontStyle: 'normal',
        lineHeight: '30px',
      },

      subtitle1: {
        fontSize: '16px',
        fontWeight: 500,
        fontStyle: 'normal',
        lineHeight: '24px',
      },
      subtitle2: {
        fontSize: '14px',
        fontWeight: 500,
        fontStyle: 'normal',
        lineHeight: '21px',
      },
      body1: {
        fontSize: '16px',
        fontWeight: 400,
        fontStyle: 'normal',
        lineHeight: '24px',
      },
      body2: {
        fontSize: '14px',
        fontWeight: 400,
        fontStyle: 'normal',
        lineHeight: '21px',
      },
      caption: {
        fontSize: '12px',
        fontWeight: 400,
        fontStyle: 'normal',
        lineHeight: '18px',
      },
      overline: {
        fontSize: '10px',
        fontWeight: 500,
        fontStyle: 'normal',
        lineHeight: '15px',
      },
      h6: {
        // overline2
        fontSize: '8px',
        fontWeight: 500,
        fontStyle: 'normal',
        lineHeight: '12px',
      },
    },
  });
