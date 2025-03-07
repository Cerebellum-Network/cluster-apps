import { PropsWithChildren, ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { isMobile } from 'react-device-detect';
import { Paper, Stack, styled, MobileOverlay, Box } from '@cluster-apps/ui';

import { Layout } from '../Layout';
import { AccountDropdown } from '../AccountDropdown';
import { useApplicationTour } from '~/components/ApplicationTour';
import Navigation from '../Navigation';
import { NavigationProps } from '../Navigation/Navigation';

export type HomeLayoutProps = PropsWithChildren<{
  rightElement?: ReactNode;
  leftElement?: ReactNode;
  headerRight?: ReactNode;
  navigationItems?: NavigationProps['items'];
  navigationFooter?: NavigationProps['footer'];
}>;

const Content = styled(Paper)(({ theme }) => ({
  zIndex: 1,
  flex: 1,
  minWidth: 800,
  padding: theme.spacing(4),
  borderTopLeftRadius: 0,
  borderTopRightRadius: 0,
  boxShadow: '0px 8px 12px 0px #1A0A7C1A', // TODO: use theme
}));

const MainContainer = styled(Stack)({
  display: 'flex',
  flexDirection: 'row',
  flex: 1,
  overflow: 'hidden',
});

const NavigationContainer = styled(Box)(({ theme }) => ({
  width: 240, // Fixed width of 240px (the expanded width)
  flexShrink: 0,
  padding: theme.spacing(2, 0),
}));

const Right = styled(Stack)(() => ({
  width: 0,
}));

const HomeLayout = ({ 
  children, 
  rightElement, 
  leftElement, 
  headerRight,
  navigationItems,
  navigationFooter
}: HomeLayoutProps) => {
  const { hideTour } = useApplicationTour();

  return (
    <Layout
      disablePaddings
      fullPage
      headerRight={
        <Stack data-tour="account" direction="row" spacing={2} onClick={hideTour}>
          {headerRight}
          <AccountDropdown />
        </Stack>
      }
    >
      <MainContainer direction="row">
        {navigationItems && (
          <NavigationContainer>
            <Navigation items={navigationItems} footer={navigationFooter} />
          </NavigationContainer>
        )}
        <Content elevation={3}>{children}</Content>
        {leftElement && <Right>{leftElement}</Right>}
      </MainContainer>
      {isMobile && <MobileOverlay />}
    </Layout>
  );
};

export default observer(HomeLayout);
