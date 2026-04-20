import { DecentralizedServerIcon } from '@cluster-apps/ui';
import { Application } from '~/applications';
import Compute from './Compute';

const application: Application = {
  rootComponent: Compute,
  rootPath: 'compute',
  title: 'Compute',
  description: 'Deploy and manage compute resources with predefined tiers for different workloads',
  icon: <DecentralizedServerIcon />,
  widget: null,
};

export default application;
