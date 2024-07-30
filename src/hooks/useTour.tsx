import { useState, useCallback } from 'react';
import { CallBackProps, STATUS, EVENTS, Step } from 'react-joyride';

interface UseTourProps {
  steps: Step[];
  initialRun?: boolean;
  initialStepIndex?: number;
}

interface UseTourReturn {
  run: boolean;
  stepIndex: number;
  steps: Step[];
  handleJoyrideCallback: (data: CallBackProps) => void;
  setRun: (run: boolean) => void;
  setSteps: (steps: Step[], index?: number) => void;
}

export const useTour = ({ steps, initialRun = false, initialStepIndex = 0 }: UseTourProps): UseTourReturn => {
  const [run, setRun] = useState(initialRun);
  const [stepIndex, setStepIndex] = useState(initialStepIndex);
  const [tourSteps, setTourSteps] = useState<Step[]>(steps);

  const handleJoyrideCallback = useCallback((data: CallBackProps) => {
    const { status, type, index } = data;

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      setStepIndex(0);
    } else if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      setStepIndex(index + 1);
    }
  }, []);

  const updateSteps = useCallback((newSteps: Step[], index?: number) => {
    setTourSteps(newSteps);
    if (index) {
      setStepIndex((prevState) => prevState + 1);
    }
  }, []);

  return { run, stepIndex, steps: tourSteps, handleJoyrideCallback, setRun, setSteps: updateSteps };
};
