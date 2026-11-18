import { ReactNode } from 'react';
import { Box, Stack, Typography } from '@cluster-apps/ui';

export type SectionProps = {
  /** Card title (18 bold). Omit for a plain card. */
  title?: string;
  /** Actions shown on the card's header row (right-aligned). */
  actions?: ReactNode;
  children?: ReactNode;
  /** Drop the body padding — e.g. for a flush table. */
  flush?: boolean;
};

/**
 * The one card every page shares (#192 review): white, 1px divider border, 16px
 * radius, 18/22 padding, optional 18px-bold title row. Replaces the per-page card
 * styles that had drifted across 4/8/10/12px radii.
 */
const Section = ({ title, actions, children, flush }: SectionProps) => {
  const hasHeader = !!title || !!actions;
  return (
    <Box
      sx={{
        backgroundColor: '#fff',
        border: '1px solid #E3E4EE',
        borderRadius: '16px',
        overflow: 'hidden',
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
          {title && <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'text.primary' }}>{title}</Typography>}
          {actions && (
            <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
              {actions}
            </Stack>
          )}
        </Stack>
      )}
      <Box
        sx={{
          padding: flush ? 0 : '18px 22px',
          paddingTop: hasHeader ? 0 : flush ? 0 : '18px',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default Section;
