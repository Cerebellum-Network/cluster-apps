import { Markdown } from '@developer-console/ui';

import * as uploadWithCli from './uploadWithCli.md';

export const StepByStepUploadDoc = () => <Markdown content={uploadWithCli.markdown} />;

export const GITHUB_GUIDE_LINK =
  'https://github.com/Cerebellum-Network/cere-ddc-sdk-js/tree/main?tab=readme-ov-file#cere-ddc-sdk-for-javascripttypescript';
