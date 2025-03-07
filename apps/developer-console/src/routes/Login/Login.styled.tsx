import { Typography, styled } from '@cluster-apps/ui';
import { Box } from '@mui/material';

export const VideoBackground = styled('video')({
  position: 'fixed',
  right: 0,
  bottom: 0,
  minWidth: '100%',
  minHeight: '100%',
  width: 'auto',
  height: 'auto',
  zIndex: -1,
  objectFit: 'cover',
});

export const LoginContainer = styled(Box)({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export const LoginBox = styled(Box)(({ theme }) => ({
  background: 'rgba(255, 255, 255, 0.1)',
  backdropFilter: 'blur(10px)',
  borderRadius: theme.spacing(3),
  padding: theme.spacing(4),
  width: '100%',
  maxWidth: '460px',
  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
  border: '1px solid rgba(255, 255, 255, 0.18)',
  margin: theme.spacing(0, 2),
  transform: 'translateY(-2vh)', // Slight upward adjustment for visual balance
}));

export const Terms = styled(Typography)(({ theme }) => ({
  marginTop: 16,
  color: theme.palette.common.white,
  '& a': {
    color: theme.palette.primary.main,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
}));
