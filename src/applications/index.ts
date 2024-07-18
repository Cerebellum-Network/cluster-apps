import { Application } from './types';

import contentDelivery from './ContentDelivery';
import activityCapture from './ActivityCapture';
import contentStorage from './ContentStorage';

const applications: Application[] = [contentStorage, contentDelivery, activityCapture];

export * from './types';

export default applications;
