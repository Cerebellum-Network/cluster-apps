import { Application } from '../types';

import { ModelsAppIcon } from './icons/ModelsAppIcon';
import Models from './Models';

const application: Application = {
  rootComponent: Models,
  rootPath: 'models',
  title: 'Models',
  description: `Browse the inference model catalog, mint an API key for your bucket, and try a model in the playground`,
  icon: <ModelsAppIcon />,
};

export default application;
