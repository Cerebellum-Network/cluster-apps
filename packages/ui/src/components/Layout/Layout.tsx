import { PropsWithChildren, ReactNode } from 'react';
import { Stack, Box, styled, Container } from '@mui/material';

import { LayoutHeader } from './LayoutHeader';

export type LayoutProps = PropsWithChildren<{
  title?: string;
  fullPage?: boolean;
  header?: ReactNode;
  headerRight?: ReactNode;
  disablePaddings?: boolean;
}>;

const Content = styled(Box)(() => ({}));

export const Layout = ({
  children,
  title,
  disablePaddings = false,
  fullPage = false,
  headerRight,
  header = <LayoutHeader title={title} fullPage={fullPage} rightElement={headerRight} />,
}: LayoutProps) => (
  <Container disableGutters={fullPage} maxWidth={!fullPage && 'xl'} component={Stack} spacing={disablePaddings ? 0 : 4}>
    {header}
    <Content>{children}</Content>
  </Container>
);
