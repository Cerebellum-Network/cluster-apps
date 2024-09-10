import { Markdown } from '@cluster-apps/ui';

import success from './success.md?raw';
import stream from './stream.md?raw';
import fileUploadStepByStep from './fileUploadStepByStep.md?raw';

export const SuccessDoc = () => <Markdown content={success} />;
export const StreamDoc = () => <Markdown content={stream} />;
export const UploadWithCliDoc = () => <Markdown content={fileUploadStepByStep} />;

export const GITHUB_GUIDE_LINK =
  'https://github.com/Cerebellum-Network/cere-ddc-sdk-js/tree/main?tab=readme-ov-file#cere-ddc-sdk-for-javascripttypescript';

export const GITHUB_TOKEN_BASED_CONTROL_GUIDE_LINK =
  'https://github.com/Cerebellum-Network/cere-ddc-sdk-js/tree/main/examples/cli#share-access-to-the-private-bucket';
