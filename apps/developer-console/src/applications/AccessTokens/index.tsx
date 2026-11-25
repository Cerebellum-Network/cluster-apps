import { SvgIcon } from '@cluster-apps/ui';

import { Application } from '../types';
import AccessTokens from './AccessTokens';
import { features } from '~/features';

/** A key: credentials for machines. */
const AccessTokensIcon = () => (
  <SvgIcon viewBox="0 0 24 24">
    <path fill="currentColor" d="M7 14a2 2 0 1 1 0-4 2 2 0 0 1 0 4m5.65-4A6 6 0 1 0 12.65 14H17v4h4v-4h2v-4z" />
  </SvgIcon>
);

const application: Application = {
  rootComponent: AccessTokens,
  rootPath: 'access-tokens',
  title: 'Access tokens',
  navLabel: 'Access tokens',
  description: features.agents
    ? 'Tokens for the cere CLI in CI, and S3 credentials for agent definitions'
    : 'Tokens for the cere CLI in CI',
  icon: <AccessTokensIcon />,
  group: 'account',
};

export default application;
