import { observer } from 'mobx-react-lite';
import { PropsWithChildren, ReactNode } from 'react';
import { Button, DiscordIcon, MobileOverlay, Paper, Stack, styled } from '@developer-console/ui';
import { AnalyticsId } from '@developer-console/analytics';

import { Layout } from '../Layout';
import { DISCORD_LINK } from '~/constants.ts';
import { AccountDropdown } from '../AccountDropdown';
import { isMobile } from 'react-device-detect';

export type HomeLayoutProps = PropsWithChildren<{
  rightElement?: ReactNode;
  leftElement?: ReactNode;
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

const HomeLayout = ({ children, rightElement, leftElement }: HomeLayoutProps) => (
  <Layout
    disablePaddings
    fullPage
    headerRight={
      <Stack direction="row" spacing={2}>
        <Button
          variant="outlined"
          color="secondary"
          href={DISCORD_LINK}
          startIcon={<DiscordIcon />}
          className={AnalyticsId.joinDiscordBtn}
          target="_blank"
          rel="noopener noreferrer"
        >
          Discord
        </Button>
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

export default observer(HomeLayout);
