import { PropsWithChildren, ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { isMobile } from 'react-device-detect';
import { Paper, Stack, styled, MobileOverlay } from '@cluster-apps/ui';

import { Layout } from '../Layout';
import { AccountDropdown } from '../AccountDropdown';
import { useApplicationTour } from '~/components/ApplicationTour';

export type HomeLayoutProps = PropsWithChildren<{
  rightElement?: ReactNode;
  leftElement?: ReactNode;
  headerRight?: ReactNode;
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

const Left = styled(Stack)(({ theme }) => ({
  flex: 1,
  maxWidth: 400,
  minWidth: 200,
  padding: theme.spacing(4, 0, 3, 3),
}));

const Right = styled(Stack)(() => ({
  width: 200,
}));

const HomeLayout = ({ children, rightElement, leftElement, headerRight }: HomeLayoutProps) => {
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
      <Stack direction="row">
        {rightElement && <Left>{rightElement}</Left>}
        <Content elevation={3}>{children}</Content>
        {leftElement && <Right>{leftElement}</Right>}
      </Stack>
      {isMobile && <MobileOverlay />}
    </Layout>
  );
};

export default observer(HomeLayout);
