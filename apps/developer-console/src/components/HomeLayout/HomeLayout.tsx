import { observer } from 'mobx-react-lite';
import { PropsWithChildren, ReactNode } from 'react';
import { Paper, Stack, styled, MobileOverlay } from '@cluster-apps/ui';

import { Layout } from '../Layout';
import { AccountDropdown } from '../AccountDropdown';
import { isMobile } from 'react-device-detect';
import { QuestHint } from '../QuestHint';
import { Typography } from '@mui/material';
import { useAccountStore } from '~/hooks';
import { useLocation } from 'react-router-dom';

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
  const location = useLocation();
  const account = useAccountStore();
  const isAccountReady = account.isReady();
  const balance = account?.balance ?? 0;
  const deposit = account?.deposit ?? 0;

  return (
    <Layout
      disablePaddings
      fullPage
      headerRight={
        <QuestHint
          quest="addTokens"
          step="addTokens"
          title=""
          position="bottom"
          content={
            <Typography variant="body2" color="textSecondary">
              Please top up your Cere Wallet and transfer tokens to your DDC account to create your first bucket and
              keep your buckets running. To get free CERE tokens, please request them in our discord channel
            </Typography>
          }
          skip={!isAccountReady || (balance > 0 && deposit > 0) || location.pathname === '/top-up'}
        >
          <Stack direction="row" spacing={2}>
            {headerRight}
            <AccountDropdown />
          </Stack>
        </QuestHint>
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
