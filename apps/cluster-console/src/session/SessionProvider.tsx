import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { ApiError, ConsoleApi } from '~/api/client';
import type { SessionInfo } from '~/api/types';
import { config } from '~/config';

import { clearStored, loadStored, saveStored } from './storage';

/**
 * The console is signed in when it holds a console-backend session the backend
 * still accepts. The SSCP wallet is needed only to get one, so it lives on the
 * sign-in page (`useWalletSignIn`), not here: signed-in pages never load the
 * wallet.
 */
export interface Session {
  restoring: boolean;
  info: SessionInfo | null;
  /** Set by the sign-in page after the backend accepted the wallet's signature. */
  adopt: (s: SessionInfo) => void;
  signOut: () => void;
  /** Why the last session ended or could not be restored, if not a plain expiry. */
  error: string | null;
  api: ConsoleApi;
}

const SessionContext = createContext<Session | null>(null);

export const describeError = (e: unknown): string => {
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
  const tokenRef = useRef<string | null>(loadStored()?.token ?? null);
  const api = useMemo(() => new ConsoleApi(config.consoleBackendUrl, () => tokenRef.current), []);
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [restoring, setRestoring] = useState(() => tokenRef.current !== null);
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
        if (!(e instanceof ApiError && e.isUnauthorized)) setError(describeError(e));
      })
      .finally(() => live && setRestoring(false));
    return () => {
      live = false;
    };
  }, [api, drop]);

  // A 401 anywhere means the session ended: back to sign-in.
  useEffect(() => {
    const onExpired = () => drop();
    window.addEventListener('cluster-console:session-expired', onExpired);
    return () => window.removeEventListener('cluster-console:session-expired', onExpired);
  }, [drop]);

  const value = useMemo<Session>(
    () => ({
      restoring,
      info,
      error,
      api,
      adopt: (s) => {
        tokenRef.current = s.session ?? null;
        if (s.session) saveStored({ token: s.session, account: s.account, expiresAt: s.expires_at });
        setError(null);
        setInfo({ ...s, session: undefined });
      },
      signOut: () => {
        drop();
        setError(null);
      },
    }),
    [restoring, info, error, api, drop],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession outside SessionProvider');
  return s;
}
