/**
 * Billing-slice runtime configuration (Phase 3 -- Billing tab).
 *
 * Same runtime-config pattern as storage/storageConfig.ts and
 * models/inferenceConfig.ts: a deployed build reads
 * `window.__RUNTIME_CONFIG__.billing`, a local `npm run dev` falls back to
 * `VITE_*`, then to the defaults below. Ported from the billing-console repo's
 * `src/config.ts` and moved under `.billing` to match this console's per-slice
 * config convention.
 *
 * These are the **Manykind-boundary** endpoints (reconciliation / payment
 * service / orchestrator) -- the only part of the Developer Console that crosses
 * the Cere <-> Manykind boundary. Kept in this one slice so that stays obvious.
 * Each URL is overridden per cell by the cef-developer-console Helm chart.
 */
const env = import.meta.env;
const trim = (v: string) => v.replace(/\/$/, '');
const flag = (v: string | boolean | undefined) => v === true || v === 'true' || v === '1';
const runtime = (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__) || {};
const b = runtime.billing ?? {};

type UrlKey = 'reconUrl' | 'paymentUrl' | 'orchestratorUrl';
const pick = (key: UrlKey, fromEnv: string | undefined, fallback: string) =>
  (b[key] as string | undefined) || fromEnv || fallback;

type FeatureKey = 'chainDeposit' | 'chainStatus' | 'declinedBanner';
const feature = (key: FeatureKey, fromEnv: string | undefined) => flag(b.features?.[key] ?? fromEnv);

/** Manykind-boundary service endpoints + feature flags for the Billing tab. */
export const config = {
  /** reconciliation-service: bills + poll-targets. */
  reconUrl: trim(pick('reconUrl', env.VITE_RECON_URL, 'http://localhost:38011')),
  /** payment-service: developer profile, USD balance/ledger, top-ups, auto-recharge. */
  paymentUrl: trim(pick('paymentUrl', env.VITE_PAYMENT_URL, 'http://localhost:38300')),
  /** orchestrator: per-agent measured usage (ddc-read bearer). */
  orchestratorUrl: trim(pick('orchestratorUrl', env.VITE_ORCHESTRATOR_URL, 'https://orchestrator.compute.test.ddcdragon.com')),
  /**
   * Parts of the design the payment-service does not serve yet; each hides
   * cleanly rather than showing invented data. `chainDeposit` stays off in this
   * console -- on-chain deposit lives in the Storage tab, not Payments.
   */
  features: {
    chainDeposit: feature('chainDeposit', env.VITE_FEATURE_CHAIN_DEPOSIT),
    chainStatus: feature('chainStatus', env.VITE_FEATURE_CHAIN_STATUS),
    declinedBanner: feature('declinedBanner', env.VITE_FEATURE_DECLINED_BANNER),
  },
};

export type BillingConfig = typeof config;
