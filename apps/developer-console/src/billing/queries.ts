import { useQuery, useQueryClient } from '@tanstack/react-query';
import { payment, recon } from './api';

export const keys = {
  bills: (a: string) => ['bills', a] as const,
  profile: (a: string) => ['profile', a] as const,
  balance: (a: string) => ['balance', a] as const,
  ledger: (a: string) => ['ledger', a] as const,
};

export const useBills = (account: string | null) =>
  useQuery({ queryKey: keys.bills(account ?? ''), queryFn: () => recon.bills(account!), enabled: !!account });

/**
 * The payment-service profile. A wallet that has never been here is
 * registered on first load, so card and top-up actions work straight away.
 */
export const useProfile = (account: string | null) =>
  useQuery({
    queryKey: keys.profile(account ?? ''),
    enabled: !!account,
    queryFn: async () => {
      const existing = await payment.profile(account!);
      if (existing) return existing;
      await payment.register(account!);
      return payment.profile(account!);
    },
  });

export const useBalance = (account: string | null) =>
  useQuery({ queryKey: keys.balance(account ?? ''), queryFn: () => payment.balance(account!), enabled: !!account });

export const useLedger = (account: string | null) =>
  useQuery({ queryKey: keys.ledger(account ?? ''), queryFn: () => payment.ledger(account!), enabled: !!account });

/** Refresh everything a payment changes. */
export function useRefreshPayments(account: string | null) {
  const qc = useQueryClient();
  return () => {
    if (!account) return;
    void qc.invalidateQueries({ queryKey: keys.profile(account) });
    void qc.invalidateQueries({ queryKey: keys.balance(account) });
    void qc.invalidateQueries({ queryKey: keys.ledger(account) });
  };
}
