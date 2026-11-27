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

export type PillProps = {
  children: ReactNode;
  tone?: PillTone;
  /**
   * An outline in the tone's colour instead of a fill: a label about the page or
   * feature (Experimental), so it never reads as one of the status pills beside it.
   */
  outlined?: boolean;
  /** 18px tall, 11px text: for a sidebar row. */
  small?: boolean;
  /** Shown on hover. */
  title?: string;
};

/**
 * The one small label pill (12/600, 22px tall): model types, statuses and the
 * "Coming soon" badge all use it, so labels look the same on every page.
 */
const Pill = ({ children, tone = 'neutral', outlined, small, title }: PillProps) => (
  <Box
    component="span"
    title={title}
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      boxSizing: 'border-box',
      height: small ? 18 : 22,
      padding: small ? '0 6px' : '0 8px',
      borderRadius: '999px',
      // Fixed px so a parent (e.g. a button's icon slot) can't rescale it.
      fontSize: small ? '11px !important' : '12px !important',
      fontWeight: 600,
      lineHeight: 1,
      whiteSpace: 'nowrap',
      color: TONES[tone].fg,
      backgroundColor: outlined ? 'transparent' : TONES[tone].bg,
      border: outlined ? `1px solid ${TONES[tone].fg}` : 'none',
    }}
  >
    {children}
  </Box>
);

export default Pill;
