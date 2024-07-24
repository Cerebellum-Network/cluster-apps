import React from 'react';
import { OnboardingContainer, RightColumn, LeftColumn, OnboardingContent } from './OnboardingLayout.styled';

import { OnboardingVideoSlider } from '../OnboardingVideoSlider';

interface OnboardingLayoutProps extends React.PropsWithChildren {
  singleColumn?: boolean;
}

export const OnboardingLayout = ({ children, singleColumn = false }: OnboardingLayoutProps) => {
  return (
    <OnboardingContainer>
      <OnboardingContent gap="40px">
        <LeftColumn>{children}</LeftColumn>
        {!singleColumn && (
          <RightColumn>
            <OnboardingVideoSlider />
          </RightColumn>
        )}
      </OnboardingContent>
    </OnboardingContainer>
  );
};
