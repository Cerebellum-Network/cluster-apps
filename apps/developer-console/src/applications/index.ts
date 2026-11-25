import { Application } from './types';

import billing from './Billing';
import contentDelivery from './ContentDelivery';
import contentStorage from './ContentStorage';
import inference from './Inference';
import sandboxes from './Sandboxes';
import agents from './Agents';
import accessTokens from './AccessTokens';
import { features } from '~/features';

// Inference is the landing page (mockup: "Inference, where everyone lands");
// the Router uses applications[0] as the index route. Agents are experimental:
// in the nav, with their routes, only when switched on (src/features.ts).
const applications: Application[] = [
  inference,
  sandboxes,
  ...(features.agents ? [agents] : []),
  contentStorage,
  contentDelivery,
  billing,
  accessTokens,
];

export * from './types';

export default applications;
