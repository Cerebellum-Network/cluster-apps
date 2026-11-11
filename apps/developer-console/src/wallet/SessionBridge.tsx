import { useEffect } from 'react';

import { useAccountStore } from '~/hooks';
import { useSession } from './session';

/**
 * Bridges the React wallet session into the MobX AccountStore. The CEF wallet is
 * hook-based (`useWalletConnect`), so it cannot live inside the store; this
 * component syncs the connected identity + signer/token accessors into the store
 * whenever they change. Renders nothing.
 */
export function SessionBridge() {
  const session = useSession();
  const accountStore = useAccountStore();

  useEffect(() => {
    accountStore.setSession({
      state: session.state,
      account: session.account,
      address: session.address,
      email: session.email,
      getSigner: session.getSigner,
      getToken: session.getToken,
    });
  }, [
    accountStore,
    session.state,
    session.account,
    session.address,
    session.email,
    session.getSigner,
    session.getToken,
  ]);

  return null;
}
