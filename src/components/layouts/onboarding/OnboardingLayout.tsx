import React, { FC } from 'react';
import { OnboardingContainer, RightColumn, LeftColumn, OnboardingContent } from './OnboardingLayout.styled';

import { OnboardingVideoSlider } from './OnboardingVideoSlider/OnboardingVideoSlider';

type OnboardingLayoutProps = {
  children: React.ReactNode;
};

export const OnboardingLayout: FC<OnboardingLayoutProps> = ({ children }) => {
  return (
    <OnboardingContainer>
      <OnboardingContent gap="40px">
        <LeftColumn>{children}</LeftColumn>
        <RightColumn>
          <OnboardingVideoSlider />
        </RightColumn>
      </OnboardingContent>
    </OnboardingContainer>
  );
};
