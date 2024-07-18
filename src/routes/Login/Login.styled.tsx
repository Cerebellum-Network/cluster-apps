import { Button, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

export const Terms = styled(Typography)({
  color: '#818083',
  fontFamily: 'Human Sans',
  fontSize: '12px',
  fontWeight: 400,
  lineHeight: '150%',
  letterSpacing: '0.08px',
  textAlign: 'center',
  marginTop: 16,
  '& a': {
    color: '#5865F2',
    textDecoration: 'none',
  },
});

export const SubmitButton = styled(Button)({
  width: '360px',
  height: '56px',
  color: '#fff',
  borderRadius: '12px',
  textTransform: 'capitalize',
  background: '#5865F2',
  padding: '16px 20px',
  boxSizing: 'border-box',
  display: 'flex',
  gap: '8px',
  '&.Mui-disabled': {
    opacity: '0.4',
    color: '#fff',
  },
  '&:hover': { background: '#727FFF' },
});

export const SubTitle = styled(Typography)({
  color: '#1D1B20',
  fontFamily: 'Human Sans',
  fontSize: '20px',
  fontWeight: '500',
  lineHeight: '133%' /* 26.6px */,
  letterSpacing: '0.15px',
  maxWidth: '780px',
  textAlign: 'center',
});

export const Title = styled(Typography)({
  color: '#1D1B20',
  fontFamily: 'Human Sans',
  fontSize: '48px',
  fontStyle: 'normal',
  fontWeight: 700,
  lineHeight: '133%',
  letterSpacing: '-0.24px',
});
