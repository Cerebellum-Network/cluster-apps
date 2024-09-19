import { PermissionRequest, WalletInitOptions } from '@cere/embed-wallet';
import { APP_EMAIL, APP_ID, APP_NAME } from '~/constants';

export const WALLET_PERMISSIONS: PermissionRequest = {};
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
