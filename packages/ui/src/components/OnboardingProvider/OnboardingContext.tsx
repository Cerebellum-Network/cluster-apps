import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

// Типы для контекста
interface OnboardingContextType {
  isOnboardingActive: boolean;
  activeHintId: string | null;
  setActiveHint: (id: string | null) => void;
  startOnboarding: () => void;
  stopOnboarding: () => void;
  restartOnboarding: () => void;
}

// Создание контекста
const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

// Хук для использования контекста
export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding должен использоваться внутри OnboardingProvider');
  }
  return context;
};

// Поставщик контекста
export const OnboardingProvider = ({ children }: { children: ReactNode }) => {
  const [isOnboardingActive, setIsOnboardingActive] = useState(true);
  const [activeHintId, setActiveHintId] = useState<string | null>(null);

  const startOnboarding = useCallback(() => setIsOnboardingActive(true), []);
  const stopOnboarding = useCallback(() => {
    setIsOnboardingActive(false);
    setActiveHintId(null); // Сброс activeHintId
  }, []);
  const setActiveHint = useCallback((id: string | null) => setActiveHintId(id), []);

  const restartOnboarding = useCallback(() => {
    setIsOnboardingActive(false);
    setTimeout(() => setIsOnboardingActive(true), 0);
  }, []);

  return (
    <OnboardingContext.Provider
      value={{ isOnboardingActive, activeHintId, setActiveHint, startOnboarding, stopOnboarding, restartOnboarding }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};
