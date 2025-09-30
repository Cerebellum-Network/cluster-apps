import { Application } from './types';

import contentDelivery from './ContentDelivery';
import activityCapture from './ActivityCapture';
import contentStorage from './ContentStorage';
import compute from '~/applications/Compute';

const applications: Application[] = [compute, contentStorage, contentDelivery, activityCapture];

export * from './types';

export default applications;
