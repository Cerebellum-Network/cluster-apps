import { PropsWithChildren } from 'react';
import { Stack, Box, styled } from '@developer-console/ui';

import { LayoutHeader } from './LayoutHeader';

export type LayoutProps = PropsWithChildren;

const Content = styled(Box)(({ theme }) => ({
  padding: theme.spacing(0, 2),
}));

export const Layout = ({ children }: LayoutProps) => {
  return (
    <Stack spacing={2}>
      <LayoutHeader />
      <Content>{children}</Content>
    </Stack>
  );
};
