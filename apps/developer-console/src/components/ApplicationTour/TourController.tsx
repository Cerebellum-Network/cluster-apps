import React, { useCallback, useEffect, useRef } from 'react';
import { useTour, TourProvider, StepType } from '@reactour/tour';
import { observable, reaction, when } from 'mobx';
import { observer } from 'mobx-react-lite';

import { useAccountStore } from '~/hooks';
import { Account } from '~/stores';
import { createBucketTourSteps, initialTourSteps, uploadTourSteps } from './Tours';

export type NamedSteps = StepType[] & { name?: string };

export type ApplicationTourProviderType = {
  showTour: (step?: string) => void;
  hideTour: () => void;
};

const TourImplementationProvider = React.createContext<ApplicationTourProviderType>({
  showTour: () => {},
  hideTour: () => {},
});

export const useApplicationTour = () => {
  return React.useContext(TourImplementationProvider);
};

type TourDescriptor = {
  steps: NamedSteps;
  name: string;
  initialStep: string;
  condition: (account: Account) => boolean;
  renderCondition: () => boolean;
  firstTour: boolean;
};

const tourDescriptors: TourDescriptor[] = [
  {
    steps: uploadTourSteps,
    name: 'uploadTourSteps',
    initialStep: 'upload',
    condition: (account: Account) =>
      account.isReady() && account.buckets.length > 0 && account.buckets.every((bucket) => bucket.storedBytes === 0),
    renderCondition: () => elementsRendered.uploadButton,
    firstTour: false,
  },
  {
    steps: createBucketTourSteps,
    name: 'createBucketTourSteps',
    initialStep: 'bucket',
    condition: (account: Account) =>
      account.isReady() && account.balance > 0 && account.deposit > 0 && account.buckets.length === 0,
    renderCondition: () => elementsRendered.createBucketScreen,
    firstTour: false,
  },
  {
    steps: initialTourSteps,
    name: 'initialTourSteps',
    initialStep: 'account',
    condition: (account: Account) => account.isReady() && account.balance === 0 && account.deposit === 0,
    renderCondition: () => elementsRendered.initialScreen && elementsRendered.createBucketScreen,
    firstTour: true,
  },
];

export const elementsRendered = observable({
  initialScreen: false,
  createBucketScreen: false,
  uploadButton: false,
});

const storeStep = (name: string) => {
  const storedSteps = JSON.parse(localStorage.getItem('toursDone') || '[]');

  if (!storedSteps.includes(name)) {
    storedSteps.push(name);
    localStorage.setItem('toursDone', JSON.stringify(storedSteps));
  }
};

export const closeTourByOverlay = (params: any = null) => {
  if (params && params.steps) {
    storeStep(params.steps.name);
  }
  params.setIsOpen(false);
};

export const getVisibleSteps = (steps: NamedSteps) => {
  const filtered = steps.filter((step) => !!document.querySelector(step.selector as string)) as NamedSteps;

  filtered.name = steps.name;

  return filtered;
};

const getToursDone = () => {
  const storedSteps = JSON.parse(localStorage.getItem('toursDone') || '[]');

  return new Set(storedSteps);
};

export const TourImplementation: React.FC<React.PropsWithChildren> = observer(({ children }) => {
  const account = useAccountStore();
  const { setSteps, setCurrentStep, setIsOpen } = useTour();

  const tourDescriptorRef = useRef<TourDescriptor | null>(null);

  const setOpen = useCallback(
    (value: boolean) => {
      requestAnimationFrame(() => {
        setIsOpen(value);
      });
    },
    [setIsOpen],
  );

  const showTour = useCallback(
    (step?: string) => {
      const tourDescriptor = tourDescriptorRef.current;

      if (tourDescriptor) {
        const steps = getVisibleSteps(tourDescriptor.steps);

        setSteps!(steps);

        const stepIndex = steps.findIndex((s) => step && s.selector === `[data-tour="${step}"]`);

        setCurrentStep(stepIndex === -1 ? 0 : stepIndex);
        setOpen(true);
      }
    },
    [setOpen, setSteps, setCurrentStep],
  );

  const hideTour = useCallback(() => {
    setOpen(false);

    const tourDescriptor = tourDescriptorRef.current;

    if (tourDescriptor) {
      storeStep(tourDescriptor.name);
    }
  }, [setOpen]);

  useEffect(() => {
    let renderConditionDisposer: (() => void) | null = null;

    const disposer = reaction(
      () => tourDescriptors.find((descriptor) => descriptor.condition(account)),
      (descriptor) => {
        if (renderConditionDisposer) {
          renderConditionDisposer();
        }

        if (!descriptor) {
          return;
        }

        tourDescriptorRef.current = descriptor;
        setOpen(false);

        const toursDone = getToursDone();
        const isOldUser = toursDone.size === 0 && !descriptor.firstTour;

        if (isOldUser || toursDone.has(descriptor.name)) {
          return;
        }

        renderConditionDisposer = when(
          () => descriptor.renderCondition(),
          () => showTour(descriptor.initialStep),
        );
      },
    );

    return disposer;
  }, [account, showTour, setOpen]);

  return (
    <TourImplementationProvider.Provider value={{ showTour, hideTour }}>{children}</TourImplementationProvider.Provider>
  );
});

export const ApplicationTourProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <TourProvider
      showDots={false}
      showBadge={false}
      scrollSmooth={true}
      steps={[]}
      onClickClose={closeTourByOverlay}
      onClickMask={closeTourByOverlay}
    >
      <TourImplementation>{children}</TourImplementation>
    </TourProvider>
  );
};
