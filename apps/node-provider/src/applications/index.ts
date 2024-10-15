import { Application } from './types';

import networkTopology from './NetworkTopology';
import configureNode from './ConfigureNode';
import payouts from './Payouts';

const applications: Application[] = [networkTopology, configureNode, payouts];

export * from './types';

export default applications;
