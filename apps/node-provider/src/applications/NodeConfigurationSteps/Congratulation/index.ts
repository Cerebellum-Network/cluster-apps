import { Application } from '../../types.ts';

import Congratulation from './Congratulation.tsx';

const application: Application = {
  rootComponent: Congratulation,
  rootPath: 'congratulation',
  title: '',
  description: ``,
  icon: null,
  hideFromMenu: true,
};

export default application;
