// Billing data hooks. billing-console uses @tanstack/react-query; the developer
// console does not depend on it, so these are plain useState/useEffect loaders
// with the same surface (data / loading / error / reload). They key off the
// connected wallet's hex public key (`useAccount().account`), normalized to the
// lowercase-no-0x form recon and payment-service expect.
import { useCallback, useEffect, useState } from 'react';

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

/** The account's USD ledger (top-ups, auto-recharges, usage charges), newest first. */
export const useLedger = (): Loadable<LedgerEntry[]> => useAccountResource((a) => payment.ledger(a));
