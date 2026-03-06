import { Application } from '../types';

import { ProviderDashboardIcon } from './icons';
import ProviderDashboard from './ProviderDashboard.tsx';

const application: Application = {
  rootComponent: ProviderDashboard,
  rootPath: 'provider-dashboard',
  title: 'Provider Dashboard',
  description: 'View per-era usage contribution, QoS metrics, and earned rewards',
  icon: <ProviderDashboardIcon />,
};

export default application;
