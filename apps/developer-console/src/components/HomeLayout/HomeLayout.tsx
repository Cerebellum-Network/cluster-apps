import { PropsWithChildren, ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { isMobile } from 'react-device-detect';
import { Box, Stack, styled, MobileOverlay } from '@cluster-apps/ui';

import { Layout } from '../Layout';
import { AccountDropdown } from '../AccountDropdown';
import { useApplicationTour } from '~/components/ApplicationTour';

export type HomeLayoutProps = PropsWithChildren<{
  /** Sidebar navigation. */
  rightElement?: ReactNode;
  /** Extra header controls, left of the account menu (Docs / Discord). */
  headerRight?: ReactNode;
}>;

/** White app sheet below the 72px header. */
const Sheet = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  backgroundColor: theme.palette.background.paper,
  minHeight: 'calc(100vh - 72px)',
}));

const SidebarNav = styled(Box)(({ theme }) => ({
  width: 240,
  flexShrink: 0,
  borderRight: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(3, 2),
}));

const Content = styled(Box)(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  padding: theme.spacing(4),
}));

const HomeLayout = ({ children, rightElement, headerRight }: HomeLayoutProps) => {
  const { hideTour } = useApplicationTour();

  return (
    <Layout
      disablePaddings
      fullPage
      headerRight={
        <Stack data-tour="account" direction="row" spacing={2} alignItems="center" onClick={hideTour}>
          {headerRight}
          <AccountDropdown />
        </Stack>
      }
    >
      <Sheet>
        {rightElement && <SidebarNav>{rightElement}</SidebarNav>}
        <Content>{children}</Content>
      </Sheet>
      {isMobile && <MobileOverlay />}
    </Layout>
  );
};

export default observer(HomeLayout);
