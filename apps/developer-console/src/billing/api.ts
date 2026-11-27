// Billing data layer: reconciliation-service (bills, read without auth) and
// payment-service (account, payments, top-ups, card), read as the connected
// wallet with its delegation token. The recon shapes are the billing-console
// prototype's; the payment-service shapes follow ddc-node's
// cluster/payment-service/openapi.yaml. The console stays on the Cere
// (DDC-billing) side only — it does NOT call the Manykind orchestrator's
// /api/v1/usage; usage comes from recon.
import { billingConfig as config } from './billingConfig';

// ── Shapes ────────────────────────────────────────────────────────────────
// reconciliation-service GET /v1/accounts/:pubkey/bills — money as decimal strings.
export interface MonthBill {
  month: string;
  status: 'estimated' | 'settled';
  eras: number;
  lines: { compute_usd: string; storage_usd: string; transfer_usd: string; put_usd: string; get_usd: string };
  usage: {
    stored_byte_months: string;
    transferred_bytes: string;
    put_requests: string;
    get_requests: string;
    cpu_units: string;
    ram_units: string;
    gpu_units: string;
  };
  total_usd: string;
}

export interface Bills {
  account: string;
  as_of: string;
  current_month: {
    month: string;
    month_to_date_usd: string;
    forecast_usd: string | null;
    days_covered: number;
    days_in_month: number;
  };
  months: MonthBill[];
  days: { date: string; total_usd: string }[];
  /** The cluster's current on-chain prices in USD; null until recon has read them. */
  rates: Rates | null;
}

export interface Rates {
  cluster_id: string;
  read_at: string;
  cpu_usd_per_unit: string;
  ram_usd_per_unit: string;
  gpu_usd_per_unit: string;
  storage_usd_per_mib_month: string;
  transfer_usd_per_mib: string;
  put_usd_per_request: string;
  get_usd_per_request: string;
}

// payment-service (ddc-node cluster/payment-service, openapi.yaml). Money is
// integer cents; the service never sends floats.
export type CardSummary = { brand: string | null; last4: string | null; exp_month: number | null; exp_year: number | null };

export interface AutoTopup {
  threshold_cents: number;
  amount_cents: number;
  /** Why auto top-up stopped charging: the card was declined, the bank asked the cardholder, or a cap. */
  paused: 'declined' | 'requires_action' | 'cap' | null;
}

/** GET /v1/accounts/{account}. */
export interface Account {
  account: string;
  status: 'active' | 'suspended' | 'closed';
  card?: CardSummary | null;
  auto_topup: AutoTopup | null;
  spend_alert_cents: number | null;
  plan: string;
  /** The active on-chain deposit, read live; omitted when the chain read fails. */
  balance?: { cere_planck: string; usd_cents: number; usd_micros?: number };
  month_so_far_cents?: number;
  attention: string[];
}

export type PaymentKind = 'topup_checkout' | 'topup_card' | 'topup_auto' | 'plan_fee' | 'credit';
export type PaymentStatus =
  | 'created'
  | 'checkout_open'
  | 'processing'
  | 'requires_action'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'refunded'
  | 'disputed';
export type FundingStatus = 'queued' | 'signed' | 'submitted' | 'in_block' | 'finalized' | 'held' | 'expired' | 'failed';

/** One payment or credit: GET /v1/accounts/{account}/payments, POST …/topups. */
export interface Payment {
  id: string;
  account: string;
  kind: PaymentKind;
  amount_cents: number;
  currency: 'usd';
  status: PaymentStatus;
  /** The on-chain deposit that follows a paid top-up; null until it succeeds. */
  funding_status: FundingStatus | null;
  /** Set only by the top-up call while Stripe Checkout is open. */
  checkout_url: string | null;
  failure?: string | null;
  created_at: string;
}

// ── Transport ─────────────────────────────────────────────────────────────
export class ApiError extends Error {
  readonly status: number;
  /** payment-service's stable error code (`card_declined`, `not_registered`, …); null when absent. */
  readonly code: string | null;
  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * A charge whose outcome is unknown: no answer (status 0) or a server error.
 * The charge may have gone through, so the user must not be told it didn't.
 */
export const isUnconfirmed = (e: unknown): boolean => !(e instanceof ApiError) || e.status === 0 || e.status >= 500;

/**
 * The wallet delegation token payment-service takes as `Authorization: Bearer`
 * (the session's `DelegationHandle`). null in the dev `?account=` view, which
 * has no wallet: payment-service then answers 401.
 */
export interface BillingAuth {
  getToken(): Promise<string>;
  /** Forces a re-mint; called once on a 401. */
  refresh(): Promise<string>;
}

/** The error body: payment-service's {"error": {code, message}}, or the old flat {"error": "…"}. */
async function readError(res: Response): Promise<ApiError> {
  let message = `Request failed (${res.status})`;
  let code: string | null = null;
  try {
    const body = await res.json();
    const err = body?.error;
    if (err && typeof err === 'object') {
      if (typeof err.message === 'string' && err.message) message = err.message;
      if (typeof err.code === 'string') code = err.code;
    } else if (err) {
      message = String(err);
    }
  } catch {
    /* not JSON */
  }
  return new ApiError(res.status, message, code);
}

async function send(url: string, init: RequestInit | undefined, token: string | null): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  try {
    return await fetch(url, { ...init, headers });
  } catch {
    throw new ApiError(0, 'The service did not respond.');
  }
}

/** A token, or a definite (4xx) refusal: nothing was sent, so nothing was charged. */
async function token(get: () => Promise<string>): Promise<string> {
  try {
    return await get();
  } catch {
    throw new ApiError(401, 'Your wallet did not authorize billing. Sign in again.', 'unauthorized');
  }
}

async function call<T>(url: string, init?: RequestInit, auth?: BillingAuth | null): Promise<T> {
  let res = await send(url, init, auth ? await token(() => auth.getToken()) : null);
  // A token that expired or was revoked between mint and use: re-mint once.
  // Safe to repeat — every call that creates something carries an Idempotency-Key.
  if (res.status === 401 && auth) res = await send(url, init, await token(() => auth.refresh()));
  if (!res.ok) throw await readError(res);
  return res.json() as Promise<T>;
}

const json = (body: unknown, idempotencyKey?: string): RequestInit => ({
  headers: {
    'content-type': 'application/json',
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
  },
  body: JSON.stringify(body),
});

export const newIdempotencyKey = () => crypto.randomUUID();

/** Recon and payment-service key accounts as lowercase hex, no 0x. */
export const normalizeAccount = (pk: string) => pk.trim().toLowerCase().replace(/^0x/, '');

/** Dollars as typed (two decimals) to the integer cents payment-service takes. */
export const toCents = (usd: number): number => Math.round(usd * 100);

// ── reconciliation-service ────────────────────────────────────────────────
export const recon = {
  bills: (account: string) => call<Bills>(`${config.reconUrl}/v1/accounts/${account}/bills?months=12`),
  agents: async (account: string): Promise<string[]> => {
    const body = await call<{ entries: { agent_id: string }[] }>(
      `${config.reconUrl}/v1/poll-targets?developer_pubkey=${account}&limit=1000`,
    );
    return [...new Set(body.entries.map((e) => e.agent_id))].sort();
  },
};

// ── payment-service ───────────────────────────────────────────────────────
/** How many payments the console reads at most (the service pages at PAYMENTS_PAGE_SIZE). */
export const PAYMENTS_CAP = 500;

/**
 * payment-service, authorized as the connected wallet. Checkout's return URLs
 * are the service's own config (STRIPE_SUCCESS_URL, STRIPE_CANCEL_URL,
 * STRIPE_CARD_SUCCESS_URL), so the console sends none: they must point at this
 * console's `/billing?checkout=success|cancelled|card`.
 */
export function paymentApi(auth: BillingAuth | null, base = config.paymentUrl) {
  const acct = (account: string) => `${base}/v1/accounts/${account}`;
  const account = async (a: string): Promise<Account | null> => {
    try {
      return await call<Account>(acct(a), undefined, auth);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'not_registered') return null;
      throw e;
    }
  };
  return {
    /** The account, or null when it is not registered yet. */
    account,
    /** Registers the account (an upsert: safe to repeat) and records the terms version shown. */
    register: (a: string, termsVersion: string, email?: string | null) =>
      call<Account>(`${acct(a)}/register`, {
        method: 'POST',
        ...json({ terms_version: termsVersion, ...(email ? { email } : {}) }, newIdempotencyKey()),
      }, auth),
    /**
     * The active on-chain deposit in USD, or null for an account not registered
     * yet. A registered account whose balance the service could not read is an
     * error, never a zero.
     */
    balance: async (a: string): Promise<number | null> => {
      const acc = await account(a);
      if (!acc) return null;
      if (!acc.balance) throw new ApiError(503, 'The balance is unavailable right now.', 'unavailable');
      return acc.balance.usd_micros != null ? acc.balance.usd_micros / 1e6 : acc.balance.usd_cents / 100;
    },
    /** Payments and credits, newest first, up to `cap`. */
    payments: async (a: string, cap = PAYMENTS_CAP): Promise<Payment[]> => {
      const out: Payment[] = [];
      let cursor: string | null = null;
      do {
        const q: string = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
        const page: { payments: Payment[]; next_cursor: string | null } = await call(`${acct(a)}/payments${q}`, undefined, auth);
        out.push(...page.payments);
        cursor = page.payments.length > 0 ? page.next_cursor : null;
      } while (cursor && out.length < cap);
      return out.slice(0, cap);
    },
    /**
     * Top up `amountCents`. With a saved card (and not `newCard`) it is charged
     * off-session and comes back `processing`; otherwise — or when the bank
     * wants the cardholder — it comes back `checkout_open` with a
     * `checkout_url`. A declined card is a 402 `card_declined`. The key is held
     * by the caller across retries, so a retry cannot charge twice; it is tied
     * to the amount and `newCard`, since another body under the same key is
     * refused.
     */
    topUp: (a: string, amountCents: number, newCard: boolean, idempotencyKey: string) =>
      call<Payment>(`${acct(a)}/topups`, {
        method: 'POST',
        ...json({ amount_cents: amountCents, ...(newCard ? { new_card: true } : {}) }, idempotencyKey),
      }, auth),
    /** Stripe Checkout in setup mode: saves a card without charging; it becomes the saved card. */
    saveCard: (a: string) =>
      call<{ checkout_url: string }>(
        `${acct(a)}/card`,
        { method: 'POST', headers: { 'Idempotency-Key': newIdempotencyKey() } },
        auth,
      ).then((r) => r.checkout_url),
    /** Turns auto top-up on or updates it; also clears a pause. Needs a saved card (409 card_required). */
    setAutoTopUp: (a: string, thresholdCents: number, amountCents: number) =>
      call<Account>(acct(a), {
        method: 'PATCH',
        ...json({ auto_topup: { threshold_cents: thresholdCents, amount_cents: amountCents } }),
      }, auth),
    disableAutoTopUp: (a: string) => call<Account>(acct(a), { method: 'PATCH', ...json({ auto_topup: null }) }, auth),
  };
}

export type PaymentApi = ReturnType<typeof paymentApi>;
