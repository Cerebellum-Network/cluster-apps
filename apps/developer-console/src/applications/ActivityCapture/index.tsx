import { ActivityAppIcon } from '@cluster-apps/ui';
import { Application } from '../types';

import ActivityCapture from './ActivityCapture';

const application: Application = {
  rootComponent: ActivityCapture,
  rootPath: 'activity-capture',
  title: 'Activity Dashboard',
  description: `Monitor customer activity including gets, puts, and data transfer across all eras`,
  icon: <ActivityAppIcon />,
};

export default application;
