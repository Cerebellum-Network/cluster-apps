import { createTheme as createBaseTheme } from '@cluster-apps/ui';
import { createTheme } from '@mui/material';

/**
 * Developer-console-local theme: the mockup's warm, bold look layered on top of
 * the shared @cluster-apps/ui theme. We extend the shared theme — MUI's
 * `createTheme(base, overrides)` deep-merges the second argument onto the first —
 * rather than editing the shared package, so the other cluster-apps are
 * unaffected. Plain-CSS bits (code surfaces, warm borders) live in theme.css as
 * `--dc-*` tokens, the same scoped-token pattern as billing.css / inference.css.
 */
const base = createBaseTheme();

const SYSTEM_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export const developerConsoleTheme = createTheme(base, {
  palette: {
    primary: { main: '#5b57f5' },
    background: { default: '#faf9f5', paper: '#ffffff' },
    text: { primary: '#1f1e1d', secondary: '#6b6a68' },
    divider: '#e4e1d8',
    action: { selected: '#eceaf6', hover: '#f3f1ec' },
  },

  shape: { borderRadius: 10 },

  typography: {
    fontFamily: SYSTEM_FONT,
    h1: { fontWeight: 800, letterSpacing: '-0.02em' },
    h2: { fontWeight: 800, letterSpacing: '-0.015em' },
    h3: { fontWeight: 700, letterSpacing: '-0.01em' },
    h4: { fontWeight: 700 },
  },

  components: {
    // Pill buttons, as in the mockup.
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 999, paddingLeft: 18, paddingRight: 18 },
      },
    },
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
  },
});
