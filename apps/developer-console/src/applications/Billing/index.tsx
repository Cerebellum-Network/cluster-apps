import { SvgIcon } from '@cluster-apps/ui';

import { Application } from '../types';
import Billing from './Billing';

/** @cluster-apps/ui ships no billing icon; a plain credit-card glyph. */
const BillingAppIcon = () => (
  <SvgIcon viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2m0 4H4V6h16zm0 4v6H4v-6zM6 16h6v-2H6z"
    />
  </SvgIcon>
);

const application: Application = {
  rootComponent: Billing,
  rootPath: 'billing',
  title: 'Billing',
  navLabel: 'Billing',
  description: `Track your usage and spending across the network, manage your balance and payment method`,
  icon: <BillingAppIcon />,
  group: 'account',
};

export default application;
