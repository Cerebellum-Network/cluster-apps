import { Markdown } from '@developer-console/ui';

import * as startGuide from './startGuide.md';
import * as success from './success.md';
import * as stream from './stream.md';
import * as uploadWithCli from './uploadWithCli.md';

export const StartGuideDoc = () => <Markdown content={startGuide.markdown} />;
export const SuccessDoc = () => <Markdown content={success.markdown} />;
export const StreamDoc = () => <Markdown content={stream.markdown} />;
export const UploadWithCliDoc = () => <Markdown content={uploadWithCli.markdown} />;
