import { ReactNode } from 'react';
import { Box, Stack, Typography } from '@cluster-apps/ui';

import { color, text } from '~/theme/tokens';

export type SectionProps = {
  /** Card title (18 bold). Omit for a plain card. */
  title?: string;
  /** A label beside the title, such as `<ExperimentalPill />`. */
  badge?: ReactNode;
  /** Actions shown on the card's header row (right-aligned). */
  actions?: ReactNode;
  children?: ReactNode;
  /** Drop the body padding — e.g. for a flush table. */
  flush?: boolean;
  /** Stretch to the parent's height (cards side by side in a row). */
  fill?: boolean;
};

/**
 * The one card every page shares (#192 review): white, 1px divider border, 16px
 * radius, 18/22 padding, optional 18px-bold title row. Replaces the per-page card
 * styles that had drifted across 4/8/10/12px radii.
 */
const Section = ({ title, badge, actions, children, flush, fill }: SectionProps) => {
  const hasHeader = !!title || !!actions;
  return (
    <Box
      sx={{
        backgroundColor: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: '16px',
        overflow: 'hidden',
        ...(fill && { height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }),
      }}
    >
      {hasHeader && (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={2}
          sx={{ padding: '18px 22px', paddingBottom: title ? '12px' : '18px' }}
        >
          {title &&
            (badge ? (
              <Stack direction="row" alignItems="center" gap="10px" flexWrap="wrap">
                <Typography component="h2" sx={text.title}>
                  {title}
                </Typography>
                {badge}
              </Stack>
            ) : (
              <Typography component="h2" sx={text.title}>
                {title}
              </Typography>
            ))}
          {actions && (
            <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
              {actions}
            </Stack>
          )}
        </Stack>
      )}
      <Box
        sx={{
          ...(fill && { flex: 1, display: 'flex', flexDirection: 'column' }),
          padding: flush ? 0 : '18px 22px',
          // A flush table lines its first and last columns up with the card title.
          ...(flush && {
            '& .MuiTableCell-root:first-of-type:not([colspan])': { paddingLeft: '22px' },
            '& .MuiTableCell-root:last-of-type:not([colspan])': { paddingRight: '22px' },
          }),
          paddingTop: hasHeader ? 0 : flush ? 0 : '18px',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default Section;
