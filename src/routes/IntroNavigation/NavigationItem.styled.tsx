import { styled } from '@mui/material';

export const NavigationCard = styled('div')(({ theme }) => ({
  position: 'relative',
  height: 200,
  width: '100%',
  padding: '40px 20px 0px 40px',
  borderRadius: 12,
  border: `1px solid ${theme.palette.divider}`,
  background: theme.palette.secondary.light,
}));

export const IconContainer = styled('div')({
  position: 'absolute',
  right: 20,
  bottom: 20,

  '& svg': {
    height: 96,
    width: 96,
  },
});
