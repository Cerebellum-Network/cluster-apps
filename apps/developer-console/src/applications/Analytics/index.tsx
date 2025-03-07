import { BarChartOutlined as AnalyticsIcon } from '@mui/icons-material';
import { Application } from '../types';

import Analytics from './Analytics';

const application: Application = {
  rootComponent: Analytics,
  rootPath: 'analytics',
  title: 'Analytics',
  description: 'View usage metrics and analytics',
  icon: <AnalyticsIcon />,
};

export default application; 