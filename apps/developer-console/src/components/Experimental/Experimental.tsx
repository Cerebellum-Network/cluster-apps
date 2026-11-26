import { Box } from '@cluster-apps/ui';

import { Pill } from '../Pill';

/** What the labels say on hover: what "experimental" means here. */
const HINT = 'Experimental: this may still change.';

/** Read by screen readers, not shown (the sidebar shows "Exp" instead). */
const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

/**
 * The compact label beside an experimental item in the sidebar: shows "Exp",
 * reads as "Experimental" to a screen reader and on hover.
 */
export const ExperimentalBadge = () => (
  <Pill tone="primary" outlined small title={HINT}>
    <span aria-hidden="true">Exp</span>
    <Box component="span" sx={visuallyHidden}>
      Experimental
    </Box>
  </Pill>
);

/** The label beside the title of every page of an experimental feature (Agents). */
export const ExperimentalPill = () => (
  <Pill tone="primary" outlined title={HINT}>
    Experimental
  </Pill>
);
