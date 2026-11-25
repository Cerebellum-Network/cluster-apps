import { SvgIcon } from '@cluster-apps/ui';

import { Application } from '../types';
import Sandboxes from './Sandboxes';

/** A box with an open lid: a container you run things in. */
const SandboxesAppIcon = () => (
  <SvgIcon viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M12 2 3 6.5v11L12 22l9-4.5v-11zm0 2.24 6.38 3.19L12 10.62 5.62 7.43zM5 9.07l6 3v7.36l-6-3zm8 10.36v-7.36l6-3v7.36z"
    />
  </SvgIcon>
);

const application: Application = {
  rootComponent: Sandboxes,
  rootPath: 'sandboxes',
  title: 'Sandboxes',
  navLabel: 'Sandboxes',
  description:
    'Isolated gVisor containers on the cluster’s nodes: any image, any command, a default-deny network, billed for what they request and use',
  icon: <SandboxesAppIcon />,
  group: 'services',
  subNav: [
    { path: '', label: 'Overview' },
    { path: 'list', label: 'Sandboxes', prefix: true },
    { path: 'usage', label: 'Usage' },
  ],
};

export default application;
