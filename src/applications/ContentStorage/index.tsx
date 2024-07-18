import { StorageAppIcon } from '@developer-console/ui';
import { Application } from '../types';

import ContentStorage from './ContentStorage';

const application: Application = {
  rootComponent: ContentStorage,
  rootPath: 'content-storage',
  title: 'Content Storage',
  description: `Store your app's data securely across a decentralized network and maintain complete control over your data sovereignty`,
  icon: <StorageAppIcon />,
};

export default application;
