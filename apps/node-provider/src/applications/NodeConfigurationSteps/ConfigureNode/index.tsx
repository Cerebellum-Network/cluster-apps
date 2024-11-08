import { Application } from '../../types.ts';

import ConfigureNode from './ConfigureNode.tsx';

const application: Application = {
  rootComponent: ConfigureNode,
  rootPath: 'configure-node',
  title: 'Configure Node',
  description: `See how your nodes are connected and interact within the decentralized network.`,
  icon: null,
  hideFromMenu: true,
};

export default application;
