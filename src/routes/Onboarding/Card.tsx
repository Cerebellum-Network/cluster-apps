import { LoadedCard, LoadingCard, SuccessCard } from './Card.styled';
import Lottie from 'lottie-react';
import LoadingAnimation from '../../assets/animations/loading.json';
import CheckAnimation from '../../assets/animations/check.json';
import { Box } from '@mui/material';

interface CardProps {
  state: 'loading' | 'success' | 'loaded' | 'idle';
}

const Card = ({ children, state = 'idle' }: React.PropsWithChildren<CardProps>) => {
  if (state === 'success') {
    return (
      <SuccessCard>
        {children}
        <Box width="100px">
          <Lottie animationData={CheckAnimation} />
        </Box>
      </SuccessCard>
    );
  }

  if (state === 'idle') {
    return <LoadingCard>{children}</LoadingCard>;
  }

  return state === 'loading' ? (
    <LoadingCard>
      {children}
      <Box width="160px">
        <Lottie animationData={LoadingAnimation} />
      </Box>
    </LoadingCard>
  ) : (
    <LoadedCard>{children} ✓</LoadedCard>
  );
};

export default Card;
