import { Markdown } from '@developer-console/ui';

import startGuide from './startGuide.md?raw';
import success from './success.md?raw';
import stream from './stream.md?raw';
import uploadWithCli from './uploadWithCli.md?raw';

export const StartGuideDoc = () => <Markdown content={startGuide} />;
export const SuccessDoc = () => <Markdown content={success} />;
export const StreamDoc = () => <Markdown content={stream} />;
export const UploadWithCliDoc = () => <Markdown content={uploadWithCli} />;
