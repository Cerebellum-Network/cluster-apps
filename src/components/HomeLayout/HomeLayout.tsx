import { observer } from 'mobx-react-lite';
import { PropsWithChildren } from 'react';
import { Layout, Paper, Stack, styled } from '@developer-console/ui';
import { AccountDropdown } from '../AccountDropdown';

export type HomeLayoutProps = PropsWithChildren<{}>;

const Content = styled(Paper)(() => ({
  flex: 1,
}));

const Navigation = styled(Stack)(() => ({
  maxWidth: 400,
  minWidth: 200,
  border: '1px solid red',
}));

const Sidebar = styled(Stack)(() => ({
  width: 200,
  border: '1px solid green',
}));

const HomeLayout = ({ children }: HomeLayoutProps) => (
  <Layout disablePaddings fullPage headerRight={<AccountDropdown />}>
    <Stack direction="row">
      <Navigation>Navigation</Navigation>
      <Content>{children}</Content>
      <Sidebar>Sidebar</Sidebar>
    </Stack>
  </Layout>
);

export default observer(HomeLayout);
