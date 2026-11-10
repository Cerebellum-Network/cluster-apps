import { config } from './billingConfig';

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

// payment-service
export interface DeveloperProfile {
  account_pubkey: string;
  has_active_card: boolean;
  card: { brand: string | null; last4: string | null; exp_month: number | null; exp_year: number | null } | null;
  auto_recharge_threshold_usd: string | null;
  auto_recharge_amount_usd: string | null;
  status: string;
}

export interface LedgerEntry {
  id: string;
  entry_type: 'manual_topup' | 'auto_recharge' | 'shortfall_cover' | 'shortfall_recharge' | string;
  amount_usd: string;
  running_balance_usd: string;
  era_id: string | null;
  origin_ref: string;
  created_at: string;
}

export interface TopupResult {
  transaction_id: string;
  status: 'succeeded' | 'pending';
  amount_usd: string;
  balance_usd: string;
  chain_funding: 'pending' | 'sent' | 'dry_run' | 'failed' | 'disabled' | 'awaiting_settlement' | 'not_recorded' | string;
  replayed: boolean;
}

// orchestrator GET /api/v1/usage
export interface AgentUsage {
  total: {
    executions: number;
    succeeded: number;
    failed: number;
    metrics: { cpuUnits: number; memoryUnits: number; gpuUnits: number };
  };
  modelBreakdown?: { model: string; unit: string; input: number; output: number; gpuUnits: number }[];
}

// ── Transport ─────────────────────────────────────────────────────────────
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError(0, 'The service did not respond.');
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = String(body.error);
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, message);
  }
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
const pay = config.paymentUrl;

export const payment = {
  /** The account's profile, or null when it is not registered yet. */
  profile: async (account: string): Promise<DeveloperProfile | null> => {
    try {
      return await call<DeveloperProfile>(`${pay}/v1/developers/${account}`);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 400 || e.status === 404) && /not registered/i.test(e.message)) {
        return null;
      }
      throw e;
    }
  },
  register: (account: string) =>
    call<unknown>(`${pay}/v1/developers`, { method: 'POST', ...json({ account_pubkey: account }, newIdempotencyKey()) }),
  balance: (account: string) =>
    call<{ balance_usd: string }>(`${pay}/v1/developers/${account}/usd-balance`).then((b) => Number(b.balance_usd)),
  /** Every ledger entry, newest first, up to `cap` (the endpoint pages at 100). */
  ledger: async (account: string, cap = 500): Promise<LedgerEntry[]> => {
    const out: LedgerEntry[] = [];
    for (let offset = 0; offset < cap; offset += 100) {
      const page = await call<{ entries: LedgerEntry[]; total: number }>(
        `${pay}/v1/developers/${account}/usd-ledger?limit=100&offset=${offset}`,
      );
      out.push(...page.entries);
      if (out.length >= page.total || page.entries.length === 0) break;
    }
    return out;
  },
  /** Stripe Checkout: charges `amountUsd` and saves the card. Returns the redirect URL. */
  checkout: (account: string, amountUsd: number, returnTo: string) =>
    call<{ checkout_url: string }>(`${pay}/v1/psp-methods`, {
      method: 'POST',
      ...json(
        {
          account_pubkey: account,
          role: 'developer',
          initial_charge_usd: amountUsd.toFixed(2),
          success_url: `${returnTo}?checkout=success`,
          cancel_url: `${returnTo}?checkout=cancelled`,
        },
        newIdempotencyKey(),
      ),
    }).then((r) => r.checkout_url),
  topUp: (account: string, amountUsd: number, idempotencyKey: string) =>
    call<TopupResult>(`${pay}/v1/developers/${account}/topups`, {
      method: 'POST',
      ...json({ amount_usd: amountUsd.toFixed(2) }, idempotencyKey),
    }),
  setAutoTopUp: (account: string, threshold: number, amount: number) =>
    call<DeveloperProfile>(`${pay}/v1/developers/${account}`, {
      method: 'PATCH',
      ...json({ auto_recharge_threshold_usd: threshold.toFixed(2), auto_recharge_amount_usd: amount.toFixed(2) }),
    }),
  disableAutoTopUp: (account: string) =>
    call<DeveloperProfile>(`${pay}/v1/developers/${account}`, {
      method: 'PATCH',
      ...json({ auto_recharge_enabled: false }),
    }),
};

// ── orchestrator ──────────────────────────────────────────────────────────
/** One agent's measured usage, read with the person's wallet delegation token. */
export const orchestrator = {
  usage: (agentId: string, from: Date, to: Date, token: string) => {
    const q = new URLSearchParams({ agentId, from: from.toISOString(), to: to.toISOString(), models: 'true' });
    return call<AgentUsage>(`${config.orchestratorUrl}/api/v1/usage?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};
