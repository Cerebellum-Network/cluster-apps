import { Button, Stack, Typography } from '@developer-console/ui';
import { observer } from 'mobx-react-lite';

import { useEffect } from 'react';
import ReactConfetti from 'react-confetti';
import Card from './Card';
import { OnboardingLayout } from '~/components';
import { useAccountStore, useOnboardingStore } from '~/hooks';
import { Link } from 'react-router-dom';

const Onboarding = () => {
  const store = useOnboardingStore();
  const accountStore = useAccountStore();

  useEffect(() => {
    if (accountStore.address) {
      store.startOnboarding();
    }
  }, [store, accountStore.address]);

  return (
    <OnboardingLayout>
      <Stack justifyContent="center" alignItems="center" flex="1">
        <Typography variant="subtitle1" fontWeight="medium" textAlign="center" sx={{ mb: 2 }}>
          🎉 Welcome aboard!
          <br />
          You're almost set to use Developer Console
        </Typography>
        <Typography variant="h3" fontWeight="bold" textAlign="center">
          Setting up your environment
        </Typography>
        <Typography variant="subtitle1" fontWeight="medium" sx={{ my: 3 }}>
          The process may take up to 30 seconds
        </Typography>
        <Stack direction="column" alignItems="center" gap={1}>
          <Card state="success" disableAnimation>
            Wallet created
          </Card>
          {store.steps[1]?.key === 'reward' && (
            <>
              {store.steps[1]?.isCompleted ? (
                <Card state="success">Tokens transferred</Card>
              ) : (
                <Card state="loading">Transferring tokens</Card>
              )}
            </>
          )}
          {store.steps[2]?.key === 'deposit' && (
            <>
              {store.steps[2]?.isCompleted ? (
                <Card state="success">Deposit is transferred successfully</Card>
              ) : (
                <Card state="loading">Topping up DDC balance with deposit</Card>
              )}
            </>
          )}
          {store.steps[3]?.key === 'bucket' && (
            <>
              {store.steps[3]?.isCompleted ? (
                <>
                  <Card state="success">First bucket is created successfully</Card>
                  <Card state="idle">Congrats! You’re All Set!</Card>
                  <Link to="/login/intro">
                    <Button>Continue</Button>
                  </Link>
                  <ReactConfetti />
                </>
              ) : (
                <Card state="loading">Creating your first bucket</Card>
              )}
            </>
          )}
        </Stack>
      </Stack>
    </OnboardingLayout>
  );
};

export default observer(Onboarding);
