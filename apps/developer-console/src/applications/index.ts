import { Application } from './types';

import contentDelivery from './ContentDelivery';
import contentStorage from './ContentStorage';

const applications: Application[] = [contentStorage, contentDelivery];

export * from './types';

export default applications;
