import { PermissionRequest, WalletInitOptions } from '@cere/embed-wallet';
import { APP_EMAIL, APP_ID, APP_NAME } from '~/constants';

export const WALLET_PERMISSIONS: PermissionRequest = {
  ed25519_signRaw: {
    title: 'Manage content access',
    description: 'Allow the app to manage access to your content.',
  },
};
export const WALLET_INIT_OPTIONS: WalletInitOptions = {
  appId: APP_ID,
  popupMode: 'modal',
  context: {
    app: {
      name: APP_NAME,
      email: APP_EMAIL,
      url: window.origin,
      logoUrl: `${window.origin}/favicon.png`,
    },
  },
  connectOptions: {
    permissions: WALLET_PERMISSIONS,
  },
};
