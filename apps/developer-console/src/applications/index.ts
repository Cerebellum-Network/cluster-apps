import { Application } from './types';

import contentDelivery from './ContentDelivery';
import contentStorage from './ContentStorage';
import models from './Models';

const applications: Application[] = [contentStorage, contentDelivery, models];

export * from './types';

export default applications;
