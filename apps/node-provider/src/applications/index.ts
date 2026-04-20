import { Application } from './types';

import networkTopology from './NetworkTopology';
import configureNode from './NodeConfigurationSteps/ConfigureNode';
import validationAndStaking from './NodeConfigurationSteps/ValidationAndStaking';
import congratulation from './NodeConfigurationSteps/Congratulation';
import payouts from './Payouts';
import clusterUsage from './ClusterUsage';

const applications: Application[] = [
  clusterUsage,
  networkTopology,
  configureNode,
  validationAndStaking,
  congratulation,
  payouts,
];

export * from './types';

export default applications;
