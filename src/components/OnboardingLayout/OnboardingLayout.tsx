import React from 'react';
import { OnboardingContainer, RightColumn, LeftColumn, OnboardingContent } from './OnboardingLayout.styled';

import { OnboardingVideoSlider } from '../OnboardingVideoSlider';

export const OnboardingLayout = ({ children }: React.PropsWithChildren) => {
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
