import { SvgIcon } from '@cluster-apps/ui';

import { Application } from '../types';
import Agents from './Agents';

/** A spark over a box: something that acts, inside a sandbox. */
const AgentsAppIcon = () => (
  <SvgIcon viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M12 1.5l1.35 3.15L16.5 6l-3.15 1.35L12 10.5l-1.35-3.15L7.5 6l3.15-1.35zM4 12h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zm1 2v6h14v-6zm3 1.5h2v3H8zm6 0h2v3h-2z"
    />
  </SvgIcon>
);

const application: Application = {
  rootComponent: Agents,
  rootPath: 'agents',
  title: 'Agents',
  navLabel: 'Agents',
  description:
    'Experimental. AI agents that run in sandboxes: a definition in your bucket, each run a sandbox, keys added by the egress proxy',
  icon: <AgentsAppIcon />,
  group: 'services',
  experimental: true,
  subNav: [
    { path: '', label: 'Overview' },
    { path: 'list', label: 'Agents', prefix: true },
    { path: 'runs', label: 'Runs', prefix: true },
  ],
};

export default application;
