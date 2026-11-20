import { SvgIcon } from '@cluster-apps/ui';

import { Application } from '../types';
import Inference from './Inference';

/** @cluster-apps/ui ships no inference icon; a plain chip/CPU glyph. */
const InferenceAppIcon = () => (
  <SvgIcon viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M9 3v2H7a2 2 0 0 0-2 2v2H3v2h2v2H3v2h2v2a2 2 0 0 0 2 2h2v2h2v-2h2v2h2v-2h2a2 2 0 0 0 2-2v-2h2v-2h-2v-2h2V9h-2V7a2 2 0 0 0-2-2h-2V3h-2v2h-2V3zm-2 4h10v10H7zm2 2v6h6V9z"
    />
  </SvgIcon>
);

const application: Application = {
  rootComponent: Inference,
  rootPath: 'inference',
  title: 'Inference',
  navLabel: 'Inference',
  description: `Run open and hosted AI models through one OpenAI-compatible endpoint, paid from your balance`,
  icon: <InferenceAppIcon />,
  group: 'services',
  subNav: [
    { path: '', label: 'Models' },
    { path: 'keys', label: 'API keys' },
    { path: 'usage', label: 'Usage' },
  ],
};

export default application;
