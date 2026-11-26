// Billing data hooks. billing-console uses @tanstack/react-query; the developer
// console does not depend on it, so these are plain useState/useEffect loaders
// with the same surface (data / loading / error / reload). They key off the
// connected wallet's hex public key (`useAccount().account`), normalized to the
// lowercase-no-0x form recon and payment-service expect, and call
// payment-service as that wallet (`useSession().delegation`).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAccount } from '~/hooks';
import { useSession } from '~/wallet/session';
import { recon, paymentApi, normalizeAccount, type Account, type Bills, type Payment, type PaymentApi } from './api';
import { billingConfig } from './billingConfig';

export interface Loadable<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** payment-service as the connected wallet; a new wallet is a new client (and a refetch). */
export function usePaymentApi(): PaymentApi {
  const { delegation } = useSession();
  return useMemo(() => paymentApi(delegation), [delegation]);
}

/** Run `load(api, account)` whenever the account or the wallet changes, plus on `reload()`. */
function useAccountResource<T>(load: (api: PaymentApi, account: string) => Promise<T>): Loadable<T> {
  const account = useAccount();
  const pubkey = account.account ? normalizeAccount(account.account) : null;
  const api = usePaymentApi();

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
    load(api, pubkey)
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
    // `load` is a stable module function; pubkey + api + tick drive refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubkey, api, tick]);

  return { data, loading, error, reload };
}

const loadBills = (_: PaymentApi, a: string) => recon.bills(a);
const loadBalance = (api: PaymentApi, a: string) => api.balance(a);
const loadAccount = (api: PaymentApi, a: string) => api.account(a);
const loadPayments = (api: PaymentApi, a: string) => api.payments(a);

export const useBills = (): Loadable<Bills> => useAccountResource(loadBills);

/** The active on-chain deposit in USD; null data for an account not registered yet. */
export const useBalance = (): Loadable<number | null> => useAccountResource(loadBalance);

/** The payment-service account; null data when it is not registered yet (distinct from "loading"). */
export const useProfile = (): Loadable<Account | null> => useAccountResource(loadAccount);

/**
 * Register the connected account in payment-service the first time it shows up
 * unregistered (profile loaded as null), then reload it and call
 * `onRegistered` (pass a stable callback) — so a top-up doesn't fail with
 * not_registered. Registration records the configured billing terms version
 * and the wallet's verified email. `register` is an upsert; this fires once per
 * account, and a failure lets a later load retry rather than looping.
 */
export function useEnsureRegistered(profile: Loadable<Account | null>, onRegistered?: () => void): void {
  const account = useAccount();
  const pubkey = account.account ? normalizeAccount(account.account) : null;
  const { email } = useSession();
  const api = usePaymentApi();
  const registeredFor = useRef<string | null>(null);
  const { loading, error, data, reload } = profile;
  useEffect(() => {
    const terms = billingConfig.termsVersion;
    // Only when the profile has loaded cleanly AND is null (unregistered).
    if (!pubkey || !terms || loading || error || data !== null || registeredFor.current === pubkey) return;
    registeredFor.current = pubkey;
    api.register(pubkey, terms, email).then(
      () => {
        reload();
        onRegistered?.();
      },
      () => {
        registeredFor.current = null; // deps unchanged → no re-run now; a later reload retries
      },
    );
  }, [pubkey, loading, error, data, reload, api, email, onRegistered]);
}

/** The account's payments and credits, newest first. */
export const usePayments = (): Loadable<Payment[]> => useAccountResource(loadPayments);
