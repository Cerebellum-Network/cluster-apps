import { Application } from './types';

import billing from './Billing';
import contentDelivery from './ContentDelivery';
import contentStorage from './ContentStorage';

const applications: Application[] = [contentStorage, contentDelivery, billing];

export * from './types';

export default applications;
