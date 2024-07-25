import { PropsWithChildren, ReactNode } from 'react';
import { styled, Stack, Box, Paper, Typography } from '@mui/material';

import { Logo } from '../Logo';

type StyleProps = {
  fullPage?: boolean;
};

export type LayoutHeaderProps = PropsWithChildren<
  StyleProps & {
    title?: string;
    rightElement?: ReactNode;
  }
>;

const Header = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'fullPage',
})<StyleProps>(({ theme, fullPage }) => ({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  height: 72,
  borderTopLeftRadius: 0,
  borderTopRightRadius: 0,
  boxShadow: 'none',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: theme.palette.divider,

  ...(fullPage && {
    borderRadius: 0,
  }),
}));

const HeaderContent = styled(Stack)({
  flex: 1,
  display: 'flex',
  justifyContent: 'center',
});

const HeaderLeft = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: theme.spacing(4),
}));

const HeaderRight = styled(HeaderLeft)(({ theme }) => ({
  left: 'auto',
  right: theme.spacing(4),
}));

export const LayoutHeader = ({
  children,
  title = 'Developer Console',
  fullPage = false,
  rightElement,
}: LayoutHeaderProps) => (
  <Stack component={Header} fullPage={fullPage} spacing={4} direction="row" boxShadow="none">
    <HeaderLeft>
      <Logo size="large">
        <Typography variant="subtitle1">{title}</Typography>
        <Typography variant="caption">Powered by Cere Network</Typography>
      </Logo>
    </HeaderLeft>
    <HeaderContent>{children}</HeaderContent>
    <HeaderRight>{rightElement}</HeaderRight>
  </Stack>
);
