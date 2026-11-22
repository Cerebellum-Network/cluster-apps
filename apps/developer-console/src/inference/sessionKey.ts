/**
 * The Inference API key created during this browser session, held in memory only
 * (never in storage: it is a bearer secret). Lets the Quickstart offer "Use the
 * key you just created" after a key was made on the API keys page, or after the
 * developer navigated away and back. Gone on reload; scoped to the account that
 * signed it; dropped once expired.
 */
import { useSyncExternalStore } from 'react';

export interface SessionKey {
  token: string;
  expiresAt: number;
  /** The wallet address that signed it. */
  account: string;
}

let current: SessionKey | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function rememberKey(key: SessionKey): void {
  current = key;
  emit();
}

export function forgetKey(): void {
  current = null;
  emit();
}

/** The remembered key if it belongs to `account` and has not expired. */
export function sessionKeyFor(account: string | null | undefined, now = Date.now()): SessionKey | null {
  if (!current || !account || current.account !== account || current.expiresAt <= now) return null;
  return current;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useSessionKey(account: string | null | undefined): SessionKey | null {
  // Snapshot is the module value itself (stable identity between changes); the
  // account/expiry filter is applied on read.
  const snap = useSyncExternalStore(subscribe, () => current);
  return snap ? sessionKeyFor(account) : null;
}
