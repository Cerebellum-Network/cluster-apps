import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';

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
  const [isOnboardingActive, setIsOnboardingActive] = useState(() => {
    const savedState = localStorage.getItem('isOnboardingActive');
    return savedState !== null ? JSON.parse(savedState) : true;
  });

  useEffect(() => {
    localStorage.setItem('isOnboardingActive', JSON.stringify(isOnboardingActive));
  }, [isOnboardingActive]);

  const startOnboarding = useCallback(() => setIsOnboardingActive(true), []);
  const stopOnboarding = useCallback(() => {
    setIsOnboardingActive(false);
  }, []);

  const restartOnboarding = useCallback(() => {
    setIsOnboardingActive(false);

    setTimeout(() => setIsOnboardingActive(true), 0);
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        isOnboardingActive,
        startOnboarding,
        stopOnboarding,
        restartOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};
