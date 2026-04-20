import { Application } from '../types';

import ClusterUsageChart from './ClusterUsage.tsx';
import { Timeline as TimelineIcon } from '@mui/icons-material';

const application: Application = {
  rootComponent: ClusterUsageChart,
  rootPath: 'cluster-usage',
  title: 'Cluster Usage',
  description: `Monitor resource utilization, active agents, and AI model performance across your cluster. Track CPU, Memory, GPU usage and deployment metrics.`,
  icon: <TimelineIcon />,
};

export default application;
