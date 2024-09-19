import { PermissionRequest, WalletInitOptions } from '@cere/embed-wallet';
import { APP_EMAIL, APP_ID, APP_NAME } from '~/constants';

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
    /**
     * Disabled reward message for now.
     * TODO: Remove if will not be needed in future
     */
    // whiteLabel: {
    //   showLoginComplete: 'new-wallet',
    //   loginCompleteSettings: {
    //     title: 'Congratulations 🎉',
    //     content: `You are now eligible to receive a reward of ${ONBOARDIN_REWARD_AMOUNT} CERE tokens. Once the transfer is complete, you will be able to see them in your wallet.`,
    //   },
    // },
  },
  connectOptions: {
    permissions: WALLET_PERMISSIONS,
  },
};
