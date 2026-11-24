import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useWalletConnect } from '@cef-ai/wallet-react';

import { ApiError, ConsoleApi } from '~/api/client';
import { signIn as signInWithWallet } from '~/api/signIn';
import type { SessionInfo } from '~/api/types';
import { config } from '~/config';

import { clearStored, loadStored, saveStored } from './storage';

/**
 * Two steps, both explicit:
 *  1. the SSCP wallet connects (passkey, at the wallet origin);
 *  2. the wallet signs the console backend's challenge, and the backend reads
 *     the account's roles from the blockchain and returns a session.
 * The console is signed in when it holds a backend session the backend still
 * accepts; the wallet is needed only to get one.
 */
export type SignInStep = 'restoring' | 'wallet' | 'challenge' | 'signed-in';

export interface Session {
  step: SignInStep;
  info: SessionInfo | null;
  /** Hex account of the connected wallet (before the challenge is signed). */
  walletAccount: string | null;
  walletBusy: boolean;
  signing: boolean;
  error: string | null;
  connectWallet: () => void;
  signChallenge: () => void;
  signOut: () => void;
  api: ConsoleApi;
}

const SessionContext = createContext<Session | null>(null);

const normalize = (pk: string) => pk.trim().toLowerCase().replace(/^0x/, '');

const describe = (e: unknown): string => {
  if (e instanceof ApiError) {
    switch (e.code) {
      case 'no_role':
        return 'This wallet has no role in this cluster: it is not the cluster manager on the blockchain, and it provides none of its nodes.';
      case 'blockchain_unavailable':
        return `The console backend could not read roles from the blockchain: ${e.message}`;
      default:
        return e.message;
    }
  }
  return e instanceof Error ? e.message : String(e);
};

export function SessionProvider({ children }: { children: ReactNode }) {
  const w = useWalletConnect({
    appId: config.appId,
    appName: config.appName,
    walletOrigin: config.walletOrigin,
    transport: config.walletTransport,
  });
  const tokenRef = useRef<string | null>(loadStored()?.token ?? null);
  const api = useMemo(() => new ConsoleApi(config.consoleBackendUrl, () => tokenRef.current), []);
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [restoring, setRestoring] = useState(() => tokenRef.current !== null);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const drop = useCallback(() => {
    tokenRef.current = null;
    clearStored();
    setInfo(null);
  }, []);

  // A stored session is used only after the backend confirms it (and re-reads
  // the roles from the blockchain).
  useEffect(() => {
    if (!tokenRef.current) return;
    let live = true;
    api
      .get<SessionInfo>('/session')
      .then((s) => live && setInfo(s))
      .catch((e) => {
        if (!live) return;
        drop();
        if (!(e instanceof ApiError && e.isUnauthorized)) setError(describe(e));
      })
      .finally(() => live && setRestoring(false));
    return () => {
      live = false;
    };
  }, [api, drop]);

  const walletAccount = w.wallet ? normalize(w.wallet.publicKeyHex) : null;

  const signChallenge = useCallback(() => {
    if (!w.wallet || !walletAccount) return;
    setSigning(true);
    setError(null);
    signInWithWallet(api, walletAccount, w.wallet.signer)
      .then((s) => {
        tokenRef.current = s.session ?? null;
        saveStored({ token: s.session!, account: s.account, expiresAt: s.expires_at });
        setInfo({ ...s, session: undefined });
      })
      .catch((e) => setError(describe(e)))
      .finally(() => setSigning(false));
  }, [api, w.wallet, walletAccount]);

  const value = useMemo<Session>(() => {
    let step: SignInStep;
    if (restoring) step = 'restoring';
    else if (info) step = 'signed-in';
    else if (w.wallet) step = 'challenge';
    else step = 'wallet';
    return {
      step,
      info,
      walletAccount,
      walletBusy: w.status === 'connecting' || w.status === 'registering' || w.status === 'resuming',
      signing,
      error: error ?? (step === 'wallet' ? w.error : null),
      connectWallet: () => {
        setError(null);
        void w.connect().catch(() => {});
      },
      signChallenge,
      signOut: () => {
        drop();
        setError(null);
        void w.logout().catch(() => {});
      },
      api,
    };
  }, [restoring, info, w, walletAccount, signing, error, signChallenge, drop, api]);

  // A 401 anywhere means the session ended: back to sign-in.
  useEffect(() => {
    const onExpired = () => drop();
    window.addEventListener('cluster-console:session-expired', onExpired);
    return () => window.removeEventListener('cluster-console:session-expired', onExpired);
  }, [drop]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession outside SessionProvider');
  return s;
}
