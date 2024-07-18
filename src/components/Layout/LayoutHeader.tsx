import { styled, Stack, Box, Logo, Typography } from '@developer-console/ui';

const Header = styled(Box)(({ theme }) => ({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  borderBottomWidth: 1,
  borderBottomStyle: 'solid',
  borderBottomColor: theme.palette.divider,
  height: 72,
}));

const HeaderContent = styled(Box)({
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

export const LayoutHeader = () => {
  return (
    <Stack spacing={4} marginY={2}>
      <Header>
        <HeaderLeft>
          <Logo size="large">
            <Typography variant="subtitle1">Developer Console</Typography>
            <Typography variant="caption">Powered by Cere Network</Typography>
          </Logo>
        </HeaderLeft>
        <HeaderContent />
        <HeaderRight>Account</HeaderRight>
      </Header>
    </Stack>
  );
};
