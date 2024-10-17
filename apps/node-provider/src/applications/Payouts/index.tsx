import { Application } from '../types';

import { PayoutsIcon } from './icons';
import Payouts from './Payouts.tsx';

const application: Application = {
  rootComponent: Payouts,
  rootPath: 'payouts',
  title: 'Payouts',
  description: `View your CERE token rewards for participating in the network`,
  icon: <PayoutsIcon />,
};

export default application;
