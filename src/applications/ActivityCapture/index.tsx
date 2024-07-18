import { ActivityAppIcon } from '@developer-console/ui';
import { Application } from '../types';

import ActivityCapture from './ActivityCapture';

const application: Application = {
  rootComponent: ActivityCapture,
  rootPath: 'activity-capture',
  title: 'Customer Data Platform',
  description: `Store user sessions data to get insights and trigger appropriate scenarios`,
  icon: <ActivityAppIcon />,
};

export default application;
