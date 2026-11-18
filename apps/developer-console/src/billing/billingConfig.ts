/**
 * Billing-slice runtime configuration.
 *
 * Same pattern as `src/config.ts` and `storage/storageConfig.ts`: a deployed
 * build reads these from `/config.js` (`window.__RUNTIME_CONFIG__.billing`,
 * mounted by the Helm chart), a local `npm run dev` falls back to `VITE_*` env,
 * then to the Dragon **devnet** defaults below (matching the dragon-ansible
 * dragon1-devnet inventory's `developer_console_recon_url` / `_payment_url`).
 * A real deploy overrides all of these per env.
 *
 * Cere (DDC-billing) side only — no Manykind orchestrator dependency:
 *   - reconUrl         reconciliation-service: bills + poll-targets (agents)
 *   - paymentUrl       payment-service: USD balance, ledger, top-ups, cards
 */
const env = import.meta.env;

type BillingRuntime = {
  reconUrl?: string;
  paymentUrl?: string;
};

const trim = (v: string) => v.replace(/\/+$/, '');
const runtime =
  (typeof window !== 'undefined' &&
    (window as { __RUNTIME_CONFIG__?: { billing?: BillingRuntime } }).__RUNTIME_CONFIG__) ||
  {};
const pick = (key: keyof BillingRuntime, fromEnv: string | undefined, fallback: string) =>
  (runtime.billing?.[key] as string | undefined) || fromEnv || fallback;

export const billingConfig = {
  /** reconciliation-service: `GET /v1/accounts/:account/bills`, `GET /v1/poll-targets`. */
  reconUrl: trim(pick('reconUrl', env.VITE_RECON_URL, 'https://reconciliation-service.compute.dev.ddcdragon.com')),
  /** payment-service: USD balance / ledger / top-ups / cards. */
  paymentUrl: trim(pick('paymentUrl', env.VITE_PAYMENT_URL, 'https://payment-service.compute.dev.ddcdragon.com')),
};

export type BillingConfig = typeof billingConfig;
