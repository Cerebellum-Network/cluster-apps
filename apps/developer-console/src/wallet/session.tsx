import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { isWalletError, type CefSigner } from '@cef-ai/wallet';
import { useWalletConnect } from '@cef-ai/wallet-react';
import { config } from '../config';

/** The index and S3 gateway key accounts as lowercase hex, no 0x. */
const normalizeAccount = (pk: string) => pk.trim().toLowerCase().replace(/^0x/, '');

/** The handoff's session states (README "State and data"). */
export type SessionState = 'idle' | 'connecting' | 'waiting' | 'connected' | 'error' | 'expired';

interface Session {
  state: SessionState;
  /** Hex public key, lowercase, no 0x — how recon and payment-service key accounts. */
  account: string | null;
  /** The account of a session that expired, for the reconnect prompt. */
  lastAccount: string | null;
  /** Cere SS58 address, for the wallet chip. */
  address: string | null;
  email: string | null;
  error: string | null;
  /** Dev builds only: viewing `?account=` without a wallet. */
  devView: boolean;
  connect: () => void;
  createWallet: () => void;
  cancel: () => void;
  signOut: () => void;
  /** A read-only (`ddc-read`) wallet-api delegation token, cached until near expiry. */
  getToken: () => Promise<string>;
  /**
   * The connected wallet as a DDC `CefSigner`, for the storage slice (the DDC SDK
   * and the S3-gateway credential registration sign through it). Throws when
   * there is no wallet session. Not available in dev `?account=` view.
   */
  getSigner: () => CefSigner;
}

const SessionContext = createContext<Session | null>(null);

function devAccount(): string | null {
  if (!import.meta.env.DEV) return null;
  const a = new URLSearchParams(window.location.search).get('account');
  return a ? normalizeAccount(a) : null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const w = useWalletConnect({
    appId: config.appId,
    appName: config.appName,
    walletOrigin: config.walletOrigin,
    transport: config.walletTransport,
  });
  const [override] = useState(devAccount);
  const [cancelled, setCancelled] = useState(false);
  const [expired, setExpired] = useState(false);
  const signingOut = useRef(false);
  const wasConnected = useRef(false);
  const [lastAccount, setLastAccount] = useState<string | null>(null);

  // A session that disappears without the user signing out has expired.
  useEffect(() => {
    if (w.wallet) {
      wasConnected.current = true;
      setLastAccount(normalizeAccount(w.wallet.publicKeyHex));
      setExpired(false);
      setCancelled(false);
    } else if (wasConnected.current && !signingOut.current && w.status !== 'resuming') {
      setExpired(true);
    }
  }, [w.wallet, w.status]);

  const delegation = useRef<{ token: string; expiresAt: number } | null>(null);
  useEffect(() => {
    delegation.current = null;
  }, [w.wallet]);

  const getToken = useCallback(async () => {
    if (!w.wallet) throw new Error('not signed in');
    const cached = delegation.current;
    if (cached && cached.expiresAt - Date.now() > 60_000) return cached.token;
    const request = { capabilities: ['ddc-read' as const], ttl: '24h' };
    let minted;
    try {
      minted = await w.wallet.requestDelegation(request);
    } catch (e) {
      // On http the wallet runs in a popup. A popup the user closed is reopened
      // signed out, and answers `unauthorized`; connect() resumes the live
      // session silently, after which one retry succeeds.
      if (!isWalletError(e) || e.code !== 'unauthorized') throw e;
      const again = await w.connect();
      minted = await again.requestDelegation(request);
    }
    delegation.current = { token: minted.token, expiresAt: Date.parse(minted.expiresAt) };
    return minted.token;
  }, [w]);

  const value = useMemo<Session>(() => {
    let state: SessionState;
    if (override) state = 'connected';
    else if (w.wallet) state = 'connected';
    else if (expired) state = 'expired';
    else if (cancelled) state = 'idle';
    else if (w.status === 'registering') state = 'waiting';
    else if (w.status === 'connecting' || w.status === 'resuming') state = 'connecting';
    else if (w.status === 'error') state = 'error';
    else state = 'idle';
    return {
      state,
      account: override ?? (w.wallet ? normalizeAccount(w.wallet.publicKeyHex) : null),
      lastAccount: override ?? lastAccount,
      address: override ? null : (w.wallet?.address ?? null),
      email: override ? null : (w.wallet?.email ?? null),
      error: w.error,
      devView: !!override,
      connect: () => {
        setCancelled(false);
        signingOut.current = false;
        void w.connect().catch(() => {});
      },
      createWallet: () => {
        setCancelled(false);
        signingOut.current = false;
        void w.createWallet().catch(() => {});
      },
      // The SDK cannot abort a registration in progress; this returns the
      // console to idle, and a wallet finished later still signs the user in.
      cancel: () => setCancelled(true),
      signOut: () => {
        signingOut.current = true;
        wasConnected.current = false;
        setExpired(false);
        setLastAccount(null);
        void w.logout().catch(() => {});
      },
      getToken,
      getSigner: () => {
        if (!w.wallet) throw new Error('not signed in');
        return w.wallet.signer;
      },
    };
  }, [w, override, expired, cancelled, getToken, lastAccount]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession outside SessionProvider');
  return s;
}
