import { Application } from './types';

import billing from './Billing';
import contentDelivery from './ContentDelivery';
import contentStorage from './ContentStorage';
import inference from './Inference';

// Inference is the landing page (mockup: "Inference, where everyone lands");
// the Router uses applications[0] as the index route.
const applications: Application[] = [inference, contentStorage, contentDelivery, billing];

export * from './types';

export default applications;
