import { ReactNode } from 'react';
import { Box, Stack, Typography } from '@cluster-apps/ui';

import { text } from '~/theme/tokens';

export type PageHeaderProps = {
  /** Page title (22/28 bold, per the mockup). */
  title: string;
  /** Optional secondary line under the title (13px). */
  subtitle?: ReactNode;
  /** Page-level actions, right-aligned on the header row. */
  actions?: ReactNode;
};

/**
 * The one header row every page shares (#192 review): title on the left, page
 * actions on the right. Lives on the page canvas, not inside a card.
 */
const PageHeader = ({ title, subtitle, actions }: PageHeaderProps) => (
  <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} minHeight={40}>
    <Box minWidth={0}>
      <Typography component="h1" sx={text.pageTitle}>
        {title}
      </Typography>
      {subtitle && <Typography sx={{ ...text.secondary, marginTop: '2px' }}>{subtitle}</Typography>}
    </Box>
    {actions && (
      <Stack direction="row" spacing={1.5} alignItems="center" flexShrink={0}>
        {actions}
      </Stack>
    )}
  </Stack>
);

export default PageHeader;
