import { Paper, styled } from '@mui/material';

export const NavigationCard = styled(Paper)(({ theme }) => ({
  position: 'relative',
  height: 200,
  padding: '40px 20px 0px 40px',
  background: theme.palette.secondary.light,
}));

export const IconContainer = styled('div')<{ smallIcon?: boolean }>(({ smallIcon }) => ({
  position: 'absolute',
  right: 20,
  bottom: 20,
  color: '#5865F2',

  '& svg': smallIcon
    ? {
        height: 48,
        width: 48,
      }
    : {
        height: 96,
        width: 96,
      },
}));
