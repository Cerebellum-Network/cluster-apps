import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface OnboardingContextType {
  isOnboardingActive: boolean;
  startOnboarding: () => void;
  stopOnboarding: () => void;
  restartOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding should be used inside OnboardingProvider');
  }
  return context;
};

export const OnboardingProvider = ({ children }: { children: ReactNode }) => {
  const [isOnboardingActive, setIsOnboardingActive] = useState(true);

  const startOnboarding = useCallback(() => setIsOnboardingActive(true), []);
  const stopOnboarding = useCallback(() => {
    setIsOnboardingActive(false);
  }, []);

  const restartOnboarding = useCallback(() => {
    setIsOnboardingActive(false);
    setTimeout(() => setIsOnboardingActive(true), 0);
  }, []);

  return (
    <OnboardingContext.Provider value={{ isOnboardingActive, startOnboarding, stopOnboarding, restartOnboarding }}>
      {children}
    </OnboardingContext.Provider>
  );
};
