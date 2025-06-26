import { Application } from './types';

import contentDelivery from './ContentDelivery';
import activityCapture from './ActivityCapture';
import contentStorage from './ContentStorage';

const applications: Application[] = [activityCapture, contentStorage, contentDelivery];

export * from './types';

export default applications;
