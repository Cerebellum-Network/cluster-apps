import { Application } from './types';

import billing from './Billing';
import contentDelivery from './ContentDelivery';
import contentStorage from './ContentStorage';
import inference from './Inference';
import sandboxes from './Sandboxes';
import agents from './Agents';
import accessTokens from './AccessTokens';

// Inference is the landing page (mockup: "Inference, where everyone lands");
// the Router uses applications[0] as the index route. Agents are experimental:
// always in the nav, labelled so there and on every Agents page.
const applications: Application[] = [
  inference,
  sandboxes,
  agents,
  contentStorage,
  contentDelivery,
  billing,
  accessTokens,
];

export * from './types';

export default applications;
