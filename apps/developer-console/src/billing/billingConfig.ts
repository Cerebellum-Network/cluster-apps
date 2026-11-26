/**
 * Billing-slice runtime configuration.
 *
 * A deployed build reads these from `/config.js` (`window.__RUNTIME_CONFIG__.billing`,
 * mounted by the Helm chart) or `VITE_*` env. The Dragon **devnet** defaults below
 * are used ONLY by a local `npm run dev` (`import.meta.env.DEV`). In a build a
 * missing URL stays undefined — never a silent devnet fallback, or a testnet/prod
 * deploy that forgot `__RUNTIME_CONFIG__.billing` would show devnet balances and
 * take payments against the devnet payment-service (#190 review). The Billing tab
 * checks `isBillingConfigured()` and shows "Billing is unavailable" instead.
 *
 * Cere (DDC-billing) side only — no Manykind orchestrator dependency:
 *   - reconUrl         reconciliation-service: bills + poll-targets (agents)
 *   - paymentUrl       payment-service: account, balance, payments, top-ups, card
 *   - termsVersion     the billing terms version payment-service records when
 *                      the console registers an account (POST …/register)
 */
const env = import.meta.env;

type BillingRuntime = {
  reconUrl?: string;
  paymentUrl?: string;
  termsVersion?: string;
};

const DEV_FALLBACK: Record<keyof BillingRuntime, string> = {
  reconUrl: 'https://reconciliation-service.compute.dev.ddcdragon.com',
  paymentUrl: 'https://payment-service.compute.dev.ddcdragon.com',
  termsVersion: 'dev',
};

const trim = (v: string) => v.trim().replace(/\/+$/, '');
const runtime =
  (typeof window !== 'undefined' &&
    (window as { __RUNTIME_CONFIG__?: { billing?: BillingRuntime } }).__RUNTIME_CONFIG__) ||
  {};

const pick = (key: keyof BillingRuntime, fromEnv: string | undefined): string | undefined => {
  const v = (runtime.billing?.[key] as string | undefined) || fromEnv;
  if (v) return trim(v);
  // Local dev may fall back to the devnet service; a build must not.
  return import.meta.env.DEV ? DEV_FALLBACK[key] : undefined;
};

export const billingConfig = {
  /** reconciliation-service: `GET /v1/accounts/:account/bills`, `GET /v1/poll-targets`. */
  reconUrl: pick('reconUrl', env.VITE_RECON_URL),
  /** payment-service: account / balance / payments / top-ups / card. */
  paymentUrl: pick('paymentUrl', env.VITE_PAYMENT_URL),
  /** Recorded on registration; without it the console cannot register an account. */
  termsVersion: pick('termsVersion', env.VITE_TERMS_VERSION),
};

/** Whether the endpoints and the terms version are configured (always true under `npm run dev`). */
export const isBillingConfigured = (): boolean =>
  !!billingConfig.reconUrl && !!billingConfig.paymentUrl && !!billingConfig.termsVersion;

export type BillingConfig = typeof billingConfig;
