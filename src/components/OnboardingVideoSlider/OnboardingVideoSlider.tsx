import { useCallback, useEffect, useRef, useState } from 'react';
import { IconButton, Stack, Typography, LeftArrowIcon, RightArrowIcon } from '@developer-console/ui';
import { styled } from '@mui/system';
import { DDC_CLUSTER_NAME } from '~/constants';
import { SliderDot } from './OnboardingVideoSlider.styled';
import video from '../../assets/videos/slider-video.mp4';

const SLIDES = [
  {
    title: `${DDC_CLUSTER_NAME} <br/> Developer Console`,
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

const VideoBackground = styled('video')({
  position: 'absolute',
  top: '50%',
  left: '50%',
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  transform: 'translate(-50%, -50%)',
  zIndex: -1,
});

const ContentContainer = styled(Stack)({
  position: 'relative',
  zIndex: 1,
  width: '100%',
  height: '100%',
  padding: '40px',
});

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

  const prevSlide = () => {
    setCurrentSlide(currentSlide === 0 ? SLIDES.length - 1 : currentSlide - 1);
    handlePlayVideo();
  };

  const handlePlayVideo = () => {
    vidRef.current?.play();
  };

  return (
    <VideoBackgroundContainer sx={{ filter: `hue-rotate(${getHueRotateValue(currentSlide)})` }}>
      <VideoBackground ref={vidRef} autoPlay muted loop>
        <source src={video} type="video/mp4" />
        Your browser does not support the video tag.
      </VideoBackground>
      <ContentContainer>
        <Stack
          direction="column"
          justifyContent="center"
          alignItems="center"
          sx={{ width: '100%', height: '100%', color: 'white' }}
        >
          <Typography
            variant="h2"
            textAlign="center"
            dangerouslySetInnerHTML={{ __html: SLIDES[currentSlide].title }}
          />
          <Typography textAlign="center" variant="subtitle1" sx={{ marginTop: '20px' }}>
            {SLIDES[currentSlide].description}
          </Typography>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ width: '100%', marginTop: 'auto', padding: '20px' }}
          >
            <IconButton onClick={prevSlide} color="inherit">
              <LeftArrowIcon />
            </IconButton>
            <Stack direction="row" gap="4px" alignItems="center" justifyContent="center">
              <SliderDot className={currentSlide === 0 ? 'active' : ''} />
              <SliderDot className={currentSlide === 1 ? 'active' : ''} />
              <SliderDot className={currentSlide === 2 ? 'active' : ''} />
            </Stack>
            <IconButton onClick={nextSlide} color="inherit">
              <RightArrowIcon />
            </IconButton>
          </Stack>
        </Stack>
      </ContentContainer>
    </VideoBackgroundContainer>
  );
};
