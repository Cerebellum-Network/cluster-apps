import { Application } from '../../types.ts';

import ValidationAndStaking from './ValidationAndStaking.tsx';

const application: Application = {
  rootComponent: ValidationAndStaking,
  rootPath: 'validation-and-staking',
  title: 'Validation and Staking',
  description: ``,
  icon: null,
  hideFromMenu: true,
};

export default application;
