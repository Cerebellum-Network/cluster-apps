import { LoadedCard, LoadingCard, SuccessCard } from './Card.styled';
import { Lottie, Box, LoadingAnimation, CheckMarkAnimation, Typography } from '@developer-console/ui';

interface CardProps {
  state: 'loading' | 'success' | 'loaded' | 'idle';
}

const Card = ({ children, state = 'idle' }: React.PropsWithChildren<CardProps>) => {
  if (state === 'success') {
    return (
      <SuccessCard>
        <Typography>{children}</Typography>
        <Box width="100px">
          <Lottie animationData={CheckMarkAnimation} />
        </Box>
      </SuccessCard>
    );
  }

  if (state === 'idle') {
    return (
      <LoadingCard>
        <Typography>{children}</Typography>
      </LoadingCard>
    );
  }

  return state === 'loading' ? (
    <LoadingCard>
      {children}
      <Box width="160px">
        <Lottie animationData={LoadingAnimation} />
      </Box>
    </LoadingCard>
  ) : (
    <LoadedCard>
      <Typography>{children} ✓</Typography>
    </LoadedCard>
  );
};

export default Card;
