import { useCallback, useEffect, useRef, useState } from 'react';
import video from '../../assets/videos/slider-video.mp4';
import { IconButton, Stack } from '@mui/material';
import { LeftArrowIcon, RightArrowIcon, Typography } from '@developer-console/ui';
import { SliderDot } from './OnboardingVideoSlider.styled';

const SLIDES = [
  {
    title: `[Cluster Name] <br/> Developer Console`,
    description:
      'Unlock the power of the first web3 Data Cloud for real-world applications and get started in just a minute with Cere Wallet',
  },
  {
    title: 'Decentralized Storage ',
    description: `Store your data on the world's most secure and accessible network with Cere DDC, ensuring scalability, cost-efficiency, and encrypted with  actionable insights.`,
  },
  {
    title: 'Content Delivery Networks',
    description:
      'Stream the data you stored on Cere’s edge node infrastructure with unprecedented speed and cost efficiency, unlocking next-gen use cases such as permissioned media streaming to NFT holders. Fully censorship-resistant.',
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

  const prevSlide = () => {
    setCurrentSlide(currentSlide === 0 ? SLIDES.length - 1 : currentSlide - 1);
    handlePlayVideo();
  };

  const handlePlayVideo = () => {
    vidRef.current?.play();
  };

  return (
    <Stack
      position="relative"
      height="100%"
      width="500px"
      bgcolor="transparent"
      sx={{ filter: `hue-rotate(${getHueRotateValue(currentSlide)})` }}
    >
      <Stack
        width="440px"
        direction="column"
        justifyContent="center"
        alignItems="center"
        position="absolute"
        top="40px"
        left="40px"
        zIndex="1"
      >
        <Typography
          variant="h4"
          color="white"
          textAlign="center"
          dangerouslySetInnerHTML={{ __html: SLIDES[currentSlide].title }}
        />
      </Stack>
      <Stack
        width="440px"
        direction="column"
        justifyContent="center"
        alignItems="center"
        position="absolute"
        bottom="80px"
        left="40px"
        zIndex="1"
      >
        <Typography textAlign="center" color="white">
          {SLIDES[currentSlide].description}
        </Typography>
      </Stack>
      <Stack
        width="440px"
        direction="row"
        justifyContent="space-between"
        position="absolute"
        bottom="40px"
        left="40px"
        zIndex="1"
      >
        <IconButton onClick={prevSlide}>
          <LeftArrowIcon />
        </IconButton>
        <Stack direction="row" gap="4px" alignItems="center" justifyContent="center">
          <SliderDot className={currentSlide === 0 ? 'active' : ''} />
          <SliderDot className={currentSlide === 1 ? 'active' : ''} />
          <SliderDot className={currentSlide === 2 ? 'active' : ''} />
        </Stack>
        <IconButton onClick={nextSlide}>
          <RightArrowIcon />
        </IconButton>
      </Stack>
      <video ref={vidRef} className="videoTag" style={{ width: '100%' }} muted>
        <source src={video} type="video/mp4" />
      </video>
    </Stack>
  );
};
