import { BarTrackingIcon } from '@cluster-apps/ui';
import { Application } from '../types';

import CustomerUsage from './CustomerUsage';

const application: Application = {
  rootComponent: CustomerUsage,
  rootPath: 'customer-usage',
  title: 'Customer Usage',
  description: 'View per-era usage metrics and charges across your account',
  icon: <BarTrackingIcon />,
};

export default application;
