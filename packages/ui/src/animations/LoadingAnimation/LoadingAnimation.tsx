import Lottie, { LottieComponentProps } from 'lottie-react';
import loadingAnimation from './loading.json';

export type LoadingAnimationProps = Omit<LottieComponentProps, 'animationData'>;

export const LoadingAnimation = (props: LoadingAnimationProps) => {
  return <Lottie animationData={loadingAnimation} {...props} />;
};
