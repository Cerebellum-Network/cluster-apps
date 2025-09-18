import { Application } from '../types';

import { NetworkTopologyIcon } from './icons';
import NetworkTopology from './NetworkTopology.tsx';

const application: Application = {
  rootComponent: NetworkTopology,
  rootPath: 'network-topology',
  title: 'Network Topology',
  description: `See how your nodes are connected and interact within the decentralized network.`,
  icon: <NetworkTopologyIcon />,
};

export default application;
