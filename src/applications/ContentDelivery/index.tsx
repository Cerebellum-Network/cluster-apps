import { CdnAppIcon } from '@developer-console/ui';
import { Application } from '../types';

import ContentDelivery from './ContentDelivery';

const application: Application = {
  rootComponent: ContentDelivery,
  rootPath: 'content-delivery',
  title: 'Content Delivery',
  description: `Deliver content with low latency and high transfer speeds`,
  icon: <CdnAppIcon />,
};

export default application;
