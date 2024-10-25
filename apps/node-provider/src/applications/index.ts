import { Application } from './types';

import networkTopology from './NetworkTopology';
import configureNode from './NodeConfigurationSteps/ConfigureNode';
import validationAndStaking from './NodeConfigurationSteps/ValidationAndStaking';
import payouts from './Payouts';

const applications: Application[] = [networkTopology, configureNode, validationAndStaking, payouts];

export * from './types';

export default applications;
