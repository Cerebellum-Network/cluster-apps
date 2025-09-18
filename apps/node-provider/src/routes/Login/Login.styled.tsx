import { Typography, styled } from '@cluster-apps/ui';

export const Terms = styled(Typography)(({ theme }) => ({
  marginTop: 16,
  '& a': {
    color: theme.palette.primary.main,
    textDecoration: 'none',
  },
}));
