import { APP_EMAIL, APP_NAME } from '~/constants';
import { PermissionRequest } from '@cere/embed-wallet';

export const WALLET_PERMISSIONS: PermissionRequest = {
  ed25519_signRaw: {
    title: 'Account creation',
    description: null,
  },
  ed25519_signPayload: {
    title: 'Buckets creation',
    description: null,
  },
};

export const WALLET_INIT_OPTIONS = {
  popupMode: 'modal' as const,
  context: {
    app: {
      name: APP_NAME,
      email: APP_EMAIL,
      url: 'https://wallet.cere.io',
      logoUrl: 'https://cdn.cere.io/assets/logo.svg',
    },
  },
  connectOptions: {
    permissions: WALLET_PERMISSIONS,
    network: 'mainnet',
    chains: ['cere'],
    defaultChain: 'cere',
  },
};
