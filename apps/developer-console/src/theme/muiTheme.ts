import { createTheme, type Theme } from '@mui/material/styles';
import { theme as cereTheme } from '@cere/cere-design-system';

/**
 * The Cere Design System theme, with the palette mode and fonts the billing
 * handoff specifies. Screen styling reads the --b-* tokens directly, so this
 * mostly governs MUI internals (focus rings, tooltips, inputs).
 */
export function billingTheme(mode: 'light' | 'dark'): Theme {
  return createTheme(cereTheme, {
    palette: {
      mode,
      primary: { main: '#aa44f2', dark: '#7c59ac', contrastText: '#ffffff' },
      background: mode === 'dark' ? { default: '#0d0627', paper: '#160e36' } : { default: '#f5f1f7', paper: '#ffffff' },
      text: mode === 'dark' ? { primary: '#f5f1f7', secondary: '#c4b9cb' } : { primary: '#1d1b20', secondary: '#5f5c64' },
    },
    typography: { fontFamily: 'var(--font-sans)' },
    transitions: { easing: { easeInOut: 'cubic-bezier(0.2, 0, 0, 1)' } },
  });
}
