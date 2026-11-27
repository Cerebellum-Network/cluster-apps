import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createDelegationHandle, type CefSigner, type DelegationHandle } from '@cef-ai/wallet';
import { useWalletConnect } from '@cef-ai/wallet-react';
import { config } from '../config';
import { clearUsageTokens } from '../inference/usageToken';
import { forgetKey } from '../inference/sessionKey';
import { BOOT_GRACE_MS, nextBootPhase, type BootPhase } from './bootPhase';

/** The index and S3 gateway key accounts as lowercase hex, no 0x. */
const normalizeAccount = (pk: string) => pk.trim().toLowerCase().replace(/^0x/, '');

/** The handoff's session states (README "State and data"). */
export type SessionState = 'idle' | 'connecting' | 'waiting' | 'connected' | 'error' | 'expired';

export interface Session {
  state: SessionState;
  /**
   * True until the boot-time silent resume has answered. While it is, a
   * returning user is not signed out yet: pages wait instead of sending them
   * to /login (which would lose their deep link).
   */
  resuming: boolean;
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
  /**
   * The connected wallet as a DDC `CefSigner`, for the storage slice (the DDC SDK
   * and the S3-gateway credential registration sign through it). Throws when
   * there is no wallet session. Not available in dev `?account=` view.
   */
  getSigner: () => CefSigner;
  /**
   * The wallet's delegation token for payment-service (`Authorization: Bearer`),
   * minted on first use and re-minted near expiry or on `refresh()`. null with
   * no wallet session, including the dev `?account=` view.
   */
  delegation: DelegationHandle | null;
}

/**
 * Delegation tokens for payment-service. One hour: the token can start a card
 * charge, and re-minting needs no keys and no prompt.
 */
const DELEGATION_TTL = '1h';

/** Exported for render tests, which provide a fixed session. */
export const SessionContext = createContext<Session | null>(null);

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
  const [boot, setBoot] = useState<BootPhase>('pending');

  // Minting is lazy (on the first getToken), so building the handle has no effect
  // until billing asks; a new wallet gets a new handle and the old one is closed.
  const wallet = w.wallet;
  const delegation = useMemo(
    () =>
      wallet
        ? createDelegationHandle(() =>
            wallet.requestDelegation({ capabilities: ['ddc-read'], appId: config.appId, ttl: DELEGATION_TTL }),
          )
        : null,
    [wallet],
  );
  useEffect(() => () => delegation?.close(), [delegation]);

  useEffect(() => setBoot((p) => nextBootPhase(p, w.status)), [w.status]);
  useEffect(() => {
    const t = setTimeout(() => setBoot((p) => (p === 'pending' ? 'settled' : p)), BOOT_GRACE_MS);
    return () => clearTimeout(t);
  }, []);

  // A session that disappears without the user signing out has expired.
  useEffect(() => {
    if (w.wallet) {
      wasConnected.current = true;
      setLastAccount(normalizeAccount(w.wallet.publicKeyHex));
      setExpired(false);
      setCancelled(false);
    } else if (wasConnected.current && !signingOut.current && w.status !== 'resuming') {
      // The usage token is a COMPUTE bearer for the bucket: it must not outlive the session.
      clearUsageTokens();
      forgetKey();
      setExpired(true);
    }
  }, [w.wallet, w.status]);

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
      resuming: !override && boot !== 'settled',
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
        clearUsageTokens();
        forgetKey();
        void w.logout().catch(() => {});
      },
      getSigner: () => {
        if (!w.wallet) throw new Error('not signed in');
        return w.wallet.signer;
      },
      delegation: override ? null : delegation,
    };
  }, [w, override, expired, cancelled, lastAccount, boot, delegation]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession outside SessionProvider');
  return s;
}
