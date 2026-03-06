import { Application } from './types';

import contentDelivery from './ContentDelivery';
import activityCapture from './ActivityCapture';
import contentStorage from './ContentStorage';
import customerUsage from './CustomerUsage';

const applications: Application[] = [contentStorage, contentDelivery, activityCapture, customerUsage];

export * from './types';

export default applications;
