import { ReactNode } from 'react';
import { Box } from '@cluster-apps/ui';

import { color } from '~/theme/tokens';

const TONES = {
  neutral: { fg: color.textSecondary, bg: color.neutralFill },
  primary: { fg: color.primaryDark, bg: color.primaryTint },
  success: { fg: color.success, bg: color.successTint },
  warning: { fg: color.warning, bg: color.warningTint },
} as const;

export type PillTone = keyof typeof TONES;

/**
 * The one small label pill (12/600, 22px tall): model types, statuses and the
 * "Coming soon" badge all use it, so labels look the same on every page.
 */
const Pill = ({ children, tone = 'neutral' }: { children: ReactNode; tone?: PillTone }) => (
  <Box
    component="span"
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      height: 22,
      padding: '0 8px',
      borderRadius: '999px',
      // Fixed px so a parent (e.g. a button's icon slot) can't rescale it.
      fontSize: '12px !important',
      fontWeight: 600,
      lineHeight: 1,
      whiteSpace: 'nowrap',
      color: TONES[tone].fg,
      backgroundColor: TONES[tone].bg,
    }}
  >
    {children}
  </Box>
);

export default Pill;
