import { Button, Stack } from '@mui/material';
import { observer } from 'mobx-react-lite';

import { useEffect, useState } from 'react';
import { SubTitle, Title } from './Onboarding.styled';
import ReactConfetti from 'react-confetti';
import Card from './Card';
import { OnboardingLayout } from '~/components/layouts/onboarding/OnboardingLayout';
import { DiscordIcon, Layout } from '@developer-console/ui';

type StepState = 'hidden' | 'loading' | 'loaded' | 'success' | 'idle';

interface StepsState {
  wallet: StepState;
  ddc: StepState;
  tokens: StepState;
}

const Onboarding = () => {
  const [stepsState, setStepsState] = useState<StepsState>({
    wallet: 'loaded',
    ddc: 'loading',
    tokens: 'hidden',
  });
  const [showConfetti, setShowConfetti] = useState(false);

  // TODO: Remove it when connected to the logic
  useEffect(() => {
    setTimeout(() => {
      setStepsState((prevStepsState) => ({ ...prevStepsState, ddc: 'success' }));
      setTimeout(() => {
        setStepsState((prevStepsState) => ({ ...prevStepsState, tokens: 'loading' }));
        setTimeout(() => {
          setStepsState((prevStepsState) => ({ ...prevStepsState, tokens: 'success' }));
        }, 3000);
      }, 3000);
    }, 5000);
  }, []);

  useEffect(() => {
    const successStep = Object.entries(stepsState).find(([, state]) => state === 'success');

    if (successStep) {
      setTimeout(() => {
        setStepsState((prevStepsState) => ({ ...prevStepsState, [successStep[0]]: 'loaded' }));
      }, 1500);
    }
  }, [stepsState]);

  useEffect(() => {
    if (stepsState.tokens === 'success') {
      setShowConfetti(true);

      setTimeout(() => {
        setShowConfetti(false);
      }, 10000);
    }
  }, [stepsState.tokens]);

  return (
    <Layout
      headerRight={
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" color="secondary">
            Developer Docs
          </Button>

          <Button startIcon={<DiscordIcon />}>Discord</Button>
        </Stack>
      }
    >
      <OnboardingLayout>
        <Stack justifyContent={'center'} alignItems={'center'} flex="1">
          <SubTitle sx={{ mb: 2 }}>
            🎉 Welcome aboard!
            <br />
            You're almost set to use Developer Console
          </SubTitle>
          <Title>Setting up your environment</Title>
          <SubTitle sx={{ my: 3, fontWeight: 500 }}>The process may take up to 30 seconds</SubTitle>
          <Stack direction="column" gap={1}>
            <Card state="loaded">Wallet created</Card>
            {stepsState.ddc === 'loading' && <Card state="loading">Creating DDC Account</Card>}
            {stepsState.ddc === 'success' && <Card state="success">DDC Account Created</Card>}
            {stepsState.ddc === 'loaded' && <Card state="loaded">DDC Account Created</Card>}
            {stepsState.tokens === 'loading' && <Card state="loading">Transferring tokens</Card>}
            {stepsState.tokens === 'success' && <Card state="success">Tokens transferred</Card>}
            {stepsState.tokens === 'loaded' && (
              <>
                <Card state="loaded">Tokens transferred</Card>
                <Card state="idle">Congrats! You’re All Set!</Card>
                {showConfetti && <ReactConfetti />}
              </>
            )}
          </Stack>
        </Stack>
      </OnboardingLayout>
    </Layout>
  );
};

export default observer(Onboarding);
