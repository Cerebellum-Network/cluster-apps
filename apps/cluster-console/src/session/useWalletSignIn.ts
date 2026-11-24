import { useCallback, useState } from 'react';
import { useWalletConnect } from '@cef-ai/wallet-react';

import { signIn } from '~/api/signIn';
import { config } from '~/config';

import { describeError, useSession } from './SessionProvider';

const normalize = (pk: string) => pk.trim().toLowerCase().replace(/^0x/, '');

/**
 * The two sign-in steps, both from a click:
 *  1. connect the SSCP wallet (passkey, at the wallet origin);
 *  2. the wallet signs the console backend's challenge; the backend reads the
 *     account's roles from the blockchain and returns a session.
 * Mounted on the sign-in page only, so no other page loads the wallet.
 */
export function useWalletSignIn() {
  const session = useSession();
  const w = useWalletConnect({
    appId: config.appId,
    appName: config.appName,
    walletOrigin: config.walletOrigin,
    transport: config.walletTransport,
  });
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const account = w.wallet ? normalize(w.wallet.publicKeyHex) : null;

  const connect = useCallback(() => {
    setError(null);
    void w.connect().catch(() => {});
  }, [w]);

  const sign = useCallback(() => {
    if (!w.wallet || !account) return;
    setSigning(true);
    setError(null);
    signIn(session.api, account, w.wallet.signer)
      .then((s) => session.adopt(s))
      .catch((e) => setError(describeError(e)))
      .finally(() => setSigning(false));
  }, [w.wallet, account, session]);

  const useAnother = useCallback(() => {
    setError(null);
    void w.logout().catch(() => {});
  }, [w]);

  return {
    account,
    busy: w.status === 'connecting' || w.status === 'registering' || w.status === 'resuming',
    signing,
    error: error ?? w.error ?? session.error,
    connect,
    sign,
    useAnother,
  };
}
