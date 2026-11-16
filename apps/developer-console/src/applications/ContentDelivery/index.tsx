import { Application } from '../types';

import { CdnAppIcon } from './icons';
import ContentDelivery from './ContentDelivery';

const application: Application = {
  rootComponent: ContentDelivery,
  rootPath: 'content-delivery',
  title: 'Content Delivery',
  navLabel: 'Delivery',
  description: `Deliver content with low latency and high transfer speeds`,
  icon: <CdnAppIcon />,
  group: 'services',
};

export default application;
