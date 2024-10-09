import { StorageAppIcon } from '@cluster-apps/ui';

import { QuestStatus } from '~/components/QuestStatus';
import { FEATURE_USER_ONBOARDING } from '~/constants';
import { Application } from '../types';
import ContentStorage from './ContentStorage';

const application: Application = {
  rootComponent: ContentStorage,
  rootPath: 'content-storage',
  title: 'Content Storage',
  description: `Store your app's data securely across a decentralized network and maintain complete control over your data sovereignty`,
  icon: <StorageAppIcon />,
  widget: FEATURE_USER_ONBOARDING && <QuestStatus name="uploadFile" />,
};

export default application;
