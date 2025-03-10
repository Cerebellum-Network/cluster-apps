import * as React from 'react';

interface OnboardingLayoutProps {
  children: React.ReactNode;
}

// This component is no longer used directly for the login screen
// but kept for compatibility with other parts of the application
export const OnboardingLayout = ({ children }: OnboardingLayoutProps) => {
  return <>{children}</>;
};
