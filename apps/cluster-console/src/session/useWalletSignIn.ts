import { useCallback, useRef, useState } from 'react';
import { useWalletConnect, type ConnectedWallet } from '@cef-ai/wallet-react';

import { needsClick, signIn, walletMessage } from '~/api/signIn';
import { config } from '~/config';

import { describeError, useSession } from './SessionProvider';

const normalize = (pk: string) => pk.trim().toLowerCase().replace(/^0x/, '');

/**
 * Where a one-click sign-in is:
 *  - `wallet`: the wallet is connecting (passkey at the wallet);
 *  - `signing`: the wallet signs the console backend's challenge;
 *  - `checking`: the backend checks the signature and reads the role from the blockchain;
 *  - `needs-click`: the wallet asked for one more click from the page before it signs.
 */
export type SignInPhase = 'idle' | 'wallet' | 'signing' | 'checking' | 'needs-click';

/**
 * Sign-in in one step. One click connects the SSCP wallet and, as soon as it
 * is connected, asks it to sign the backend's challenge: the signature proves
 * the person holds the wallet's key, and the backend reads that key's role
 * from the blockchain. A wallet resumed from an earlier visit is offered as
 * "Continue as …": the same click signs (the wallet may ask for the passkey).
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
  const [phase, setPhase] = useState<SignInPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<ConnectedWallet | null>(null);
  const resumed = w.wallet ? normalize(w.wallet.publicKeyHex) : null;

  const sign = useCallback(
    async (cw: ConnectedWallet) => {
      pending.current = cw;
      setPhase('signing');
      try {
        const s = await signIn(session.api, normalize(cw.publicKeyHex), cw.signer, () => setPhase('checking'));
        pending.current = null;
        session.adopt(s);
      } catch (e) {
        if (needsClick(e)) {
          setPhase('needs-click');
          return;
        }
        pending.current = null;
        setPhase('idle');
        setError(walletMessage(e) ?? describeError(e));
      }
    },
    [session],
  );

  /** The one button: connect if needed, then sign. */
  const start = useCallback(() => {
    setError(null);
    if (w.wallet) {
      void sign(w.wallet);
      return;
    }
    setPhase('wallet');
    w.connect()
      .then((cw) => sign(cw))
      .catch((e: unknown) => {
        setPhase('idle');
        setError(walletMessage(e) ?? describeError(e));
      });
  }, [w, sign]);

  /** The wallet asked for a click of its own: sign again from this one. */
  const resume = useCallback(() => {
    if (pending.current) void sign(pending.current);
  }, [sign]);

  const useAnother = useCallback(() => {
    setError(null);
    setPhase('idle');
    pending.current = null;
    void w.logout().catch(() => {});
  }, [w]);

  return {
    /** The account the wallet resumed from an earlier visit, if any. */
    resumed,
    restoring: w.status === 'resuming' && phase === 'idle',
    phase,
    busy: phase !== 'idle' && phase !== 'needs-click',
    error: error ?? session.error,
    start,
    resume,
    useAnother,
  };
}
