import { ReactNode } from 'react';
import { Box, Stack, Typography, Logo } from '@cluster-apps/ui';

import { DDC_CLUSTER_NAME } from '~/constants';
import { AccountDropdown } from '../AccountDropdown';

export type AppHeaderProps = {
  /** Controls left of the account menu (Docs / Discord). */
  right?: ReactNode;
};

/**
 * The app's top bar (#192 review): 56px, white with a bottom border, the logo and
 * product name on the left, Docs/Discord + the account menu on the right. Supplied
 * as the shared Layout's `header` override so the shared package is untouched.
 */
const AppHeader = ({ right }: AppHeaderProps) => (
  <Box
    component="header"
    sx={{
      height: 56,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      backgroundColor: '#fff',
      borderBottom: '1px solid #E3E4EE',
    }}
  >
    <Logo>
      <Typography sx={{ fontSize: 15, fontWeight: 700, lineHeight: 1.15, color: 'text.primary' }}>
        {DDC_CLUSTER_NAME} Developer Console
      </Typography>
      <Typography sx={{ fontSize: 12, color: '#818083', lineHeight: 1.2 }}>Powered by Cere Network</Typography>
    </Logo>
    <Stack direction="row" spacing={1.5} alignItems="center">
      {right}
      <AccountDropdown />
    </Stack>
  </Box>
);

export default AppHeader;
