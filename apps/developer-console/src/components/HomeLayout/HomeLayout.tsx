import { PropsWithChildren, ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { isMobile } from 'react-device-detect';
import { Box, Stack, styled, MobileOverlay } from '@cluster-apps/ui';

import { Layout } from '../Layout';
import { AppHeader } from '../AppHeader';
import { useApplicationTour } from '~/components/ApplicationTour';

export type HomeLayoutProps = PropsWithChildren<{
  /** Sidebar navigation. */
  rightElement?: ReactNode;
  /** Extra header controls, left of the account menu (Docs / Discord). */
  headerRight?: ReactNode;
}>;

/** Content row below the 56px header: grouped sidebar + page canvas. */
const Sheet = styled(Stack)(() => ({
  flexDirection: 'row',
  minHeight: 'calc(100vh - 56px)',
}));

const SidebarNav = styled(Box)(() => ({
  width: 248,
  flexShrink: 0,
  backgroundColor: '#FAFAFC',
  borderRight: '1px solid #E3E4EE',
  padding: '20px 12px',
}));

const Content = styled(Box)(() => ({
  flex: 1,
  minWidth: 0,
  backgroundColor: '#F5F7FA',
  padding: '24px 32px',
}));

const HomeLayout = ({ children, rightElement, headerRight }: HomeLayoutProps) => {
  const { hideTour } = useApplicationTour();

  return (
    <Layout
      disablePaddings
      fullPage
      header={
        <Box data-tour="account" onClick={hideTour}>
          <AppHeader right={headerRight} />
        </Box>
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
