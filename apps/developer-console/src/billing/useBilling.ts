// Billing data hooks. billing-console uses @tanstack/react-query; the developer
// console does not depend on it, so these are plain useState/useEffect loaders
// with the same surface (data / loading / error / reload). They key off the
// connected wallet's hex public key (`useAccount().account`), normalized to the
// lowercase-no-0x form recon and payment-service expect.
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAccount } from '~/hooks';
import { recon, payment, normalizeAccount, type Bills, type DeveloperProfile, type LedgerEntry } from './api';

export interface Loadable<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Run `load(account)` whenever the connected account changes, plus on `reload()`. */
function useAccountResource<T>(load: (account: string) => Promise<T>): Loadable<T> {
  const account = useAccount();
  const pubkey = account.account ? normalizeAccount(account.account) : null;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!pubkey) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    load(pubkey)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Something went wrong.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `load` is a stable module function; pubkey + tick drive refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubkey, tick]);

  return { data, loading, error, reload };
}

export const useBills = (): Loadable<Bills> => useAccountResource(recon.bills);

export const useBalance = (): Loadable<number> => useAccountResource(payment.balance);

/** payment.profile returns null for an unregistered account; keep that distinct from "loading". */
export const useProfile = (): Loadable<DeveloperProfile | null> => useAccountResource(payment.profile);

/**
 * Register the connected account as a developer in payment-service the first time
 * it shows up unregistered (`payment.profile` === null), then reload the profile —
 * so top-up / checkout don't fail with "not registered as developer" (a fresh
 * account otherwise never gets a developer record; the console didn't register
 * anywhere). `register` is idempotent (carries an Idempotency-Key); this fires
 * once per account, and a failure lets a later load retry rather than looping.
 */
export function useEnsureDeveloper(profile: Loadable<DeveloperProfile | null>): void {
  const account = useAccount();
  const pubkey = account.account ? normalizeAccount(account.account) : null;
  const registeredFor = useRef<string | null>(null);
  const { loading, error, data, reload } = profile;
  useEffect(() => {
    // Only when the profile has loaded cleanly AND is null (unregistered).
    if (!pubkey || loading || error || data !== null || registeredFor.current === pubkey) return;
    registeredFor.current = pubkey;
    payment.register(pubkey).then(
      () => reload(),
      () => {
        registeredFor.current = null; // deps unchanged → no re-run now; a later reload retries
      },
    );
  }, [pubkey, loading, error, data, reload]);
}

/** The account's USD ledger (top-ups, auto-recharges, usage charges), newest first. */
export const useLedger = (): Loadable<LedgerEntry[]> => useAccountResource((a) => payment.ledger(a));
