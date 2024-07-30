import { StorageAppIcon } from '@developer-console/ui';
import { Application } from '../types';

import ContentStorage from './ContentStorage';
import { QuestStatus } from '~/components/QuestStatus';

const application: Application = {
  rootComponent: ContentStorage,
  rootPath: 'content-storage',
  title: 'Content Storage',
  description: `Store your app's data securely across a decentralized network and maintain complete control over your data sovereignty`,
  icon: <StorageAppIcon />,
  widget: <QuestStatus name="uploadFile" />,
};

export default application;
