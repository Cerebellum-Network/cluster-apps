import { styled } from '@mui/material/styles';

const Card = styled('div')({
  position: 'relative',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  width: 500,
  textAlign: 'center',
  fontFamily: 'Human Sans',
  fontSize: 20,
  fontWeight: 500,
  lineHeight: '133%',
  letterSpacing: '0.15px',
});

export const LoadedCard = styled(Card)({
  height: 40,
  borderRadius: 8,
  border: '1px solid #49BF63',
  color: '#49BF63',
});

export const LoadingCard = styled(Card)({
  height: 100,
  borderRadius: 16,
  border: '1px solid #CDCCCD',
  color: '#1D1B20',

  '& > div': {
    position: 'absolute',
    right: -30,
    top: '50%',
    transform: 'translateY(-50%)',
  },
});

export const SuccessCard = styled(LoadingCard)({
  borderColor: '#49BF63',
  color: '#49BF63',

  '& > div': {
    right: 0,
  },
});
