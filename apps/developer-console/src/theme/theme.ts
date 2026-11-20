import { createTheme } from '@mui/material';
import { createTheme as createBaseTheme } from '@cluster-apps/ui';

import { color, text } from './tokens';

/**
 * Developer-console theme: the shared @cluster-apps/ui theme (HumanSans, primary
 * #5865F2, page background #F5F7FA, text #1D1B20, 8px/36px buttons) with the
 * few component defaults every console page shares, so pages don't restyle them
 * one by one:
 *   - secondary text #5E5C6B (the shared #818083 is below 4.5:1 on white at 13px),
 *     dividers #E3E4EE (the card border);
 *   - table headers 12/600 secondary, one row border colour;
 *   - dialog titles at the card-title size (18 bold).
 */
const base = createBaseTheme();

export const developerConsoleTheme = createTheme(base, {
  palette: {
    divider: color.border,
    text: { primary: color.text, secondary: color.textSecondary },
  },
  components: {
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottomColor: color.border },
        head: { ...text.label, whiteSpace: 'nowrap' },
      },
    },
    MuiDialogTitle: {
      styleOverrides: { root: { ...text.title, padding: '20px 24px 12px' } },
    },
  },
});
