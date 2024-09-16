import { Markdown } from '@cluster-apps/ui';

import fileUploadStepByStep from './fileUploadStepByStep.md?raw';

export const StepByStepUploadDoc = () => <Markdown content={fileUploadStepByStep} />;

export const GITHUB_GUIDE_LINK =
  'https://github.com/Cerebellum-Network/cere-ddc-sdk-js/tree/main?tab=readme-ov-file#cere-ddc-sdk-for-javascripttypescript';
