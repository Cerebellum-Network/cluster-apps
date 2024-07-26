import { Markdown } from '@developer-console/ui';

import startGuide from './startGuide.md?raw';
import success from './success.md?raw';
import stream from './stream.md?raw';
import fileUploadStepByStep from './fileUploadStepByStep.md?raw';

export const StartGuideDoc = () => <Markdown content={startGuide} />;
export const SuccessDoc = () => <Markdown content={success} />;
export const StreamDoc = () => <Markdown content={stream} />;
export const UploadWithCliDoc = () => <Markdown content={fileUploadStepByStep} />;

export const GITHUB_GUIDE_LINK =
  'https://github.com/Cerebellum-Network/cere-ddc-sdk-js/tree/main?tab=readme-ov-file#cere-ddc-sdk-for-javascripttypescript';
