import { useEffect, useState } from 'react';
import { LoadedCard, LoadingCard, SuccessCard } from './Card.styled';
import { Box, LoadingAnimation, CheckMarkAnimation, Typography } from '@cluster-apps/ui';

interface CardProps {
  state: 'loading' | 'success' | 'idle';
  disableAnimation?: boolean;
}

const Card = ({ children, state = 'idle', disableAnimation }: React.PropsWithChildren<CardProps>) => {
  const [playSuccessAnimation, setPlaySuccessAnimation] = useState<boolean | null>(null);

  useEffect(() => {
    if (state === 'success' && playSuccessAnimation !== false && !playSuccessAnimation) {
      setPlaySuccessAnimation(true);

      setTimeout(() => setPlaySuccessAnimation(false), 1500);
    }
  }, [state, playSuccessAnimation]);

  if (state === 'success') {
    return playSuccessAnimation && !disableAnimation ? (
      <SuccessCard>
        <Typography>{children}</Typography>
        <Box width="100px">
          <CheckMarkAnimation />
        </Box>
      </SuccessCard>
    ) : (
      <LoadedCard>
        <Typography>{children} ✓</Typography>
      </LoadedCard>
    );
  }

  if (state === 'idle') {
    return (
      <LoadingCard>
        <Typography>{children}</Typography>
      </LoadingCard>
    );
  }

  return (
    <LoadingCard>
      <Typography>{children}</Typography>
      <Box width="160px">
        <LoadingAnimation />
      </Box>
    </LoadingCard>
  );
};

export default Card;
