import { useCallback, useEffect, useRef, useState } from 'react';
import { Stack, Typography } from '@cluster-apps/ui';
import { styled } from '@mui/system';
import backgroundImage from '../../assets/acaaf3c5a2e393c1ee12ee107a75ec1b.png';
import { Box } from '@mui/material';

const SLIDES = [
  {
    title: `How to start <br/>`,
    subtitle:
      "Earn $CERE tokens for storing and delivering data there where it's needed the most. The more data requests you serve, the more you earn",
    description:
      'Unlock the power of the first web3 Data Cloud for real-world applications and get started in just a minute with Cere Wallet',
  },
  {
    title: 'Decentralized Storage ',
    description: `Store your data on the world's most secure and accessible network with Cere DDC, ensuring scalability, cost-efficiency, and encrypted with actionable insights.`,
  },
  {
    title: 'Content Delivery Networks',
    description:
      'Stream the data you stored on Cere’s edge node infrastructure with unprecedented speed and cost efficiency, unlocking next-gen use cases such as permissioned media streaming to NFT holders. Fully censorship-resistant.',
  },
];

const VideoBackgroundContainer = styled(Stack)({
  position: 'relative',
  height: '100vh',
  width: '100%',
  overflow: 'hidden',
  bgcolor: 'transparent',
});

const ImageBackground = styled('img')({
  position: 'absolute',
  top: '50%',
  left: '50%',
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  transform: 'translate(-50%, -50%)',
  zIndex: -1,
  opacity: '0.3',
});

const ContentContainer = styled(Stack)({
  position: 'relative',
  zIndex: 1,
  width: '100%',
  height: '100%',
  padding: '10px 20px',
});

const steps = [
  {
    title: '1. Create an Account',
    description: 'Use Cere Wallet to sign up for seamless interactions with Cere’s DDC and Mainnet Blockchain',
  },
  {
    title: '2. Create your first node',
    description: 'Set up your infrastructure to host a node by configuring your machine to run our node software',
  },
  {
    title: '3. Stake and select a cluster',
    description: "Stake your CERE tokens and select a cluster to contribute to the network's performance",
  },
  {
    title: '4. All set!',
    description:
      "After joining a cluster, you’re all set! In just a few seconds, you're ready to harness the power of decentralized data stores",
  },
];

export const OnboardingVideoSlider = () => {
  const vidRef = useRef<HTMLVideoElement | null>(null);
  const [currentSlide, setCurrentSlide] = useState<number>(0);
  const currentStep = 0;
  const prevStepRef = useRef<number | undefined>();

  const nextSlide = useCallback(() => {
    setCurrentSlide(currentSlide === SLIDES.length - 1 ? 0 : currentSlide + 1);
    handlePlayVideo();
  }, [currentSlide]);

  useEffect(() => {
    if (prevStepRef.current !== currentStep) {
      if (currentStep !== 0) {
        nextSlide();
      }
      prevStepRef.current = currentStep;
    }
  }, [currentStep, nextSlide]);

  const getHueRotateValue = (slideIndex: number) => {
    const hueRotateValues = ['0deg', '50deg', '100deg'];
    return hueRotateValues[slideIndex] || '0deg';
  };

  const handlePlayVideo = () => {
    vidRef.current?.play();
  };

  return (
    <VideoBackgroundContainer sx={{ filter: `hue-rotate(${getHueRotateValue(currentSlide)})` }}>
      <ImageBackground src={backgroundImage}></ImageBackground>
      <ContentContainer>
        <Stack direction="column" justifyContent="center" alignItems="center" sx={{ width: '100%', height: '100%' }}>
          <Typography variant="h2" textAlign="center">
            How To Start
          </Typography>
          <Typography textAlign="center" variant="subtitle2" sx={{ marginTop: '10px' }}>
            Earn $CERE tokens for storing and delivering data there where it's needed the most. The more data requests
            you serve, the more you earn
          </Typography>
          {steps.map((step, index) => (
            <Box
              key={index}
              sx={{
                padding: '16px',
                background: '#fff',
                border: '2px solid #B2B8F9',
                borderRadius: '10px',
                marginBottom: '20px',
                textAlign: 'center',
              }}
            >
              <Typography textAlign="center" sx={{ fontSize: '24px', fontWeight: '500', marginBottom: '8px' }}>
                {step.title}
              </Typography>
              <Typography>{step.description}</Typography>
            </Box>
          ))}
        </Stack>
      </ContentContainer>
    </VideoBackgroundContainer>
  );
};
