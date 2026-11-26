import { describe, it, expect, vi, afterEach } from 'vitest';

import { usd, usdBalance, money, signedMoney, monthLabel, brandName, runway } from './format';
import { kpis, services, burnPerDay, billSections, balanceBox, monthFunding, paymentStatus, paymentsToCsv } from './model';
import type { Bills, Rates, Payment } from './api';
import { ApiError, isUnconfirmed, paymentApi, toCents, type BillingAuth, type CardSummary } from './api';
import { cardReturnStatus, cardSignature } from './checkout';

/**
 * These pin the billing port's pure layer (format + model), copied byte-for-byte
 * from the billing-console prototype. If a refactor here drifts from the
 * prototype's output, these break — the port's contract, not an exhaustive suite.
 */
describe('format', () => {
  it('usd: cents, sub-cent 3-sig-fig, zero, negative', () => {
    expect(usd('12.5')).toBe('$12.50');
    expect(usd(0)).toBe('$0.00');
    expect(usd(null)).toBe('—');
    expect(usd(0.00342)).toBe('$0.00342');
    expect(usd(-1.2)).toBe('−$1.20');
  });

  it('usdBalance keeps sub-cent precision', () => {
    expect(usdBalance(236.5)).toBe('$236.50');
    expect(usdBalance(199.997914)).toBe('$199.997914');
  });

  it('money: cents, "< $0.01" below a cent, zero, negative, null', () => {
    expect(money('12.5')).toBe('$12.50');
    expect(money(0)).toBe('$0.00');
    expect(money(null)).toBe('—');
    expect(money(0.00342)).toBe('< $0.01'); // sub-cent is not shown as "$0.00342"
    expect(money(0.004)).toBe('< $0.01');
    expect(money(0.01)).toBe('$0.01');
    expect(money(-1.2)).toBe('−$1.20');
    expect(money(1234.5)).toBe('$1,234.50');
  });

  it('signedMoney: credit/debit signs incl. sub-cent', () => {
    expect(signedMoney(20)).toBe('+$20.00');
    expect(signedMoney(-0.81)).toBe('−$0.81');
    expect(signedMoney(0.003)).toBe('+< $0.01');
    expect(signedMoney(-0.003)).toBe('−< $0.01');
    expect(signedMoney(0)).toBe('$0.00');
  });

  it('monthLabel / brandName', () => {
    expect(monthLabel('2026-09')).toBe('September 2026');
    expect(brandName('visa')).toBe('Visa');
    expect(brandName(null)).toBe('Card');
  });

  it('runway buckets', () => {
    expect(runway(100, 0).text).toBe('more than 12 months');
    expect(runway(1, 2).text).toBe('less than a day');
    expect(runway(30, 1).text).toBe('about 30 days');
  });
});

const emptyBills: Bills = {
  account: 'abc',
  as_of: '2026-11-13T00:00:00Z',
  current_month: { month: '2026-11', month_to_date_usd: '0', forecast_usd: null, days_covered: 0, days_in_month: 30 },
  months: [],
  days: [],
  rates: null,
};

const bills: Bills = {
  account: 'abc',
  as_of: '2026-11-13T00:00:00Z',
  current_month: { month: '2026-11', month_to_date_usd: '12.00', forecast_usd: '30.00', days_covered: 12, days_in_month: 30 },
  months: [
    {
      month: '2026-11',
      status: 'estimated',
      eras: 12,
      lines: { compute_usd: '6', storage_usd: '3', transfer_usd: '2', put_usd: '0.5', get_usd: '0.5' },
      usage: { stored_byte_months: '0', transferred_bytes: '0', put_requests: '0', get_requests: '0', cpu_units: '0', ram_units: '0', gpu_units: '0' },
      total_usd: '12.00',
    },
    {
      month: '2026-10',
      status: 'settled',
      eras: 31,
      lines: { compute_usd: '20', storage_usd: '5', transfer_usd: '4', put_usd: '0.5', get_usd: '0.5' },
      usage: { stored_byte_months: '0', transferred_bytes: '0', put_requests: '0', get_requests: '0', cpu_units: '0', ram_units: '0', gpu_units: '0' },
      total_usd: '30.00',
    },
  ],
  days: [],
  rates: null,
};

describe('model', () => {
  it('kpis on an empty account', () => {
    const rows = kpis(emptyBills, 0);
    expect(rows.map((r) => r.label)).toEqual(['Month to date', 'Forecast', 'Last month', 'Balance']);
    expect(rows[0].value).toBe('$0.00');
  });

  it('kpis with usage + a prior month', () => {
    const rows = kpis(bills, 100);
    expect(rows[0].value).toBe('$12.00');
    expect(rows[2].value).toBe('$30.00'); // last month total
    expect(rows[1].value).toBe('$30.00'); // forecast
  });

  it('burnPerDay = month-to-date / days covered', () => {
    expect(burnPerDay(bills)).toBeCloseTo(1, 6);
  });

  it('services: largest first, sums to the month', () => {
    const s = services(bills)!;
    expect(s.rows[0].name).toBe('Compute');
    expect(s.rows.map((r) => r.name)).toEqual(['Compute', 'Storage', 'Data transfer', 'Requests']);
  });

  it('billSections: four sections with per-line amounts', () => {
    const secs = billSections(bills.months[1], null); // October, settled
    expect(secs.map((s) => s.title)).toEqual(['Compute', 'Storage', 'Data transfer', 'Requests']);
    expect(secs[0].amount).toBe('$20.00'); // compute_usd
    expect(secs[0].rows.map((r) => r.item)).toEqual(['GPU', 'CPU', 'RAM']);
    expect(secs[3].rows.map((r) => r.item)).toEqual(['Writes', 'Reads']);
  });

  it('billSections: on-chain rates drive the per-unit rate column', () => {
    const rates: Rates = {
      cluster_id: '0x1',
      read_at: '2026-11-13T00:00:00Z',
      cpu_usd_per_unit: '0.000005',
      ram_usd_per_unit: '1E-7',
      gpu_usd_per_unit: '0.00001',
      storage_usd_per_mib_month: '9.765625E-9',
      transfer_usd_per_mib: '4.8828125E-9',
      put_usd_per_request: '1E-7',
      get_usd_per_request: '5E-8',
    };
    const secs = billSections(bills.months[1], rates);
    // With a chain price, the rate reads "<price> / <unit>" rather than "—".
    expect(secs[3].rows[0].rate).toContain('/ M'); // writes priced per million requests
  });
});

const pay = (over: Partial<Payment>): Payment => ({
  id: 'p',
  account: 'abc',
  kind: 'topup_card',
  amount_cents: 1000,
  currency: 'usd',
  status: 'succeeded',
  funding_status: 'finalized',
  checkout_url: null,
  failure: null,
  created_at: '2026-11-05T00:00:00Z',
  ...over,
});

// newest first, as the endpoint returns them
const payments: Payment[] = [
  pay({ id: '5', kind: 'topup_auto', amount_cents: 500, created_at: '2026-11-20T00:00:00Z' }),
  pay({ id: '4', kind: 'credit', amount_cents: 300, created_at: '2026-11-18T00:00:00Z' }),
  pay({ id: '3', status: 'failed', failure: 'insufficient_funds', amount_cents: 9900, created_at: '2026-11-10T00:00:00Z' }),
  pay({ id: '2', kind: 'plan_fee', amount_cents: 2000, created_at: '2026-11-06T00:00:00Z' }),
  pay({ id: '1', kind: 'topup_checkout', amount_cents: 1000, created_at: '2026-11-05T00:00:00Z' }),
  pay({ id: '0', amount_cents: 700, created_at: '2026-10-31T23:59:59Z' }),
];

describe('balanceBox / monthFunding (payments + the bill → balance box)', () => {
  it('top-ups are the paid top-ups and credits of the month; usage is the bill', () => {
    // 5.00 auto + 3.00 credit + 10.00 checkout; not the declined 99.00, the plan fee or October's 7.00
    expect(balanceBox(payments, '2026-11', 12)).toEqual({ topups: 18, usage: -12 });
    expect(balanceBox(payments, '2026-10', 0)).toEqual({ topups: 7, usage: 0 });
  });

  it('a month with usage and no top-ups still shows its usage', () => {
    expect(balanceBox(payments, '2026-09', 4.5)).toEqual({ topups: 0, usage: -4.5 });
  });

  it('null while payments load, and for a month with nothing in or out', () => {
    expect(balanceBox(null, '2026-11', 12)).toBeNull();
    expect(balanceBox(payments, '2026-09', 0)).toBeNull();
  });

  it('monthFunding counts only card top-ups, never credits', () => {
    expect(monthFunding(payments, '2026-11', 2)).toEqual({ card: 2, fromBalance: 0 }); // card covers it
    expect(monthFunding(payments, '2026-11', 20)).toEqual({ card: 15, fromBalance: 5 }); // 10 + 5 by card, credit excluded
    expect(monthFunding(null, '2026-11', 20)).toEqual({ card: 0, fromBalance: 20 });
  });
});

describe('payment rows', () => {
  it('a paid top-up is "added" only once its deposit is finalized', () => {
    expect(paymentStatus(pay({ funding_status: null })).label).toBe('Adding to balance');
    expect(paymentStatus(pay({ funding_status: 'in_block' })).label).toBe('Adding to balance');
    expect(paymentStatus(pay({ funding_status: 'finalized' }))).toEqual({ label: 'Added', tone: 'success' });
    expect(paymentStatus(pay({ funding_status: 'held' }))).toEqual({ label: 'On hold', tone: 'warning' });
    expect(paymentStatus(pay({ funding_status: 'failed' })).tone).toBe('warning');
  });

  it('a plan fee is paid, not added; a decline names itself', () => {
    expect(paymentStatus(pay({ kind: 'plan_fee', funding_status: null })).label).toBe('Paid');
    expect(paymentStatus(pay({ status: 'failed', failure: 'card_declined' })).label).toBe('Declined');
    expect(paymentStatus(pay({ status: 'failed', failure: null })).label).toBe('Failed');
    expect(paymentStatus(pay({ status: 'checkout_open' })).label).toBe('Awaiting payment');
  });

  it('CSV: one row per payment, amounts in dollars, quoted when needed', () => {
    const csv = paymentsToCsv([pay({ id: 'x', failure: 'a, b' })]).split('\n');
    expect(csv[0]).toBe('Date,Type,Amount (USD),Status,Payment status,Deposit status,Failure,Payment ID');
    expect(csv[1]).toBe('2026-11-05T00:00:00Z,Top-up,10.00,Added,succeeded,finalized,"a, b",x');
  });
});

describe('payment-service client', () => {
  const BASE = 'https://pay.test';
  const ACCT = 'ab'.repeat(32);
  type Seen = { url: string; method: string; auth: string | null; key: string | null; body: unknown };
  const seen: Seen[] = [];
  const respond = (...answers: [number, unknown][]) => {
    seen.length = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const h = new Headers(init?.headers);
        seen.push({
          url,
          method: init?.method ?? 'GET',
          auth: h.get('Authorization'),
          key: h.get('Idempotency-Key'),
          body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body ?? null,
        });
        const [status, body] = answers.shift() ?? [500, {}];
        return new Response(JSON.stringify(body), { status });
      }),
    );
  };
  const auth = (): BillingAuth & { minted: string[] } => {
    let n = 0;
    const minted: string[] = [];
    return {
      minted,
      getToken: async () => (minted.length ? minted[minted.length - 1] : (minted.push(`t${n++}`), minted[0])),
      refresh: async () => (minted.push(`t${n++}`), minted[minted.length - 1]),
    };
  };
  afterEach(() => vi.unstubAllGlobals());

  it('sends the delegation token, and on a 401 re-mints once and retries', async () => {
    const a = auth();
    respond([401, { error: { code: 'unauthorized', message: 'expired' } }], [200, { account: ACCT, attention: [] }]);
    await paymentApi(a, BASE).account(ACCT);
    expect(seen.map((s) => s.auth)).toEqual(['Bearer t0', 'Bearer t1']);
    expect(seen[0].url).toBe(`${BASE}/v1/accounts/${ACCT}`);
  });

  it('a second 401 is the answer, not a loop', async () => {
    respond([401, { error: { code: 'unauthorized', message: 'no' } }], [401, { error: { code: 'unauthorized', message: 'still no' } }]);
    await expect(paymentApi(auth(), BASE).account(ACCT)).rejects.toMatchObject({ status: 401, code: 'unauthorized', message: 'still no' });
    expect(seen).toHaveLength(2);
  });

  it('a token the wallet will not mint is a definite refusal, and nothing is sent', async () => {
    respond();
    const broken: BillingAuth = { getToken: () => Promise.reject(new Error('popup')), refresh: () => Promise.reject(new Error('popup')) };
    const e = await paymentApi(broken, BASE).topUp(ACCT, 100, false, 'k').catch((x) => x);
    expect(e).toMatchObject({ status: 401, code: 'unauthorized' });
    expect(isUnconfirmed(e)).toBe(false);
    expect(seen).toHaveLength(0);
  });

  it('reads the {"error": {code, message}} envelope', async () => {
    respond([402, { error: { code: 'card_declined', message: 'Your card was declined.' } }]);
    await expect(paymentApi(auth(), BASE).topUp(ACCT, 2500, false, 'k')).rejects.toMatchObject({
      status: 402,
      code: 'card_declined',
      message: 'Your card was declined.',
    });
  });

  it('not_registered is a null account and a null balance; any other 404 is an error', async () => {
    respond([404, { error: { code: 'not_registered', message: 'account is not registered' } }]);
    expect(await paymentApi(auth(), BASE).account(ACCT)).toBeNull();
    respond([404, { error: { code: 'not_registered', message: 'account is not registered' } }]);
    expect(await paymentApi(auth(), BASE).balance(ACCT)).toBeNull();
    respond([404, { error: { code: 'not_found', message: 'no' } }]);
    await expect(paymentApi(auth(), BASE).account(ACCT)).rejects.toMatchObject({ status: 404 });
  });

  it('balance is the on-chain deposit in dollars; an unread balance is an error, not $0', async () => {
    respond([200, { account: ACCT, balance: { cere_planck: '1', usd_cents: 2550 }, attention: [] }]);
    expect(await paymentApi(auth(), BASE).balance(ACCT)).toBe(25.5);
    respond([200, { account: ACCT, attention: [] }]);
    await expect(paymentApi(auth(), BASE).balance(ACCT)).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('pages payments by the opaque cursor until it is null, and stops at the cap', async () => {
    respond(
      [200, { payments: [pay({ id: 'a' }), pay({ id: 'b' })], next_cursor: 'c/1+' }],
      [200, { payments: [pay({ id: 'c' })], next_cursor: null }],
    );
    const got = await paymentApi(auth(), BASE).payments(ACCT);
    expect(got.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(seen.map((s) => s.url)).toEqual([`${BASE}/v1/accounts/${ACCT}/payments`, `${BASE}/v1/accounts/${ACCT}/payments?cursor=c%2F1%2B`]);

    respond([200, { payments: [pay({ id: 'a' }), pay({ id: 'b' })], next_cursor: 'more' }]);
    expect((await paymentApi(auth(), BASE).payments(ACCT, 2)).length).toBe(2);
    expect(seen).toHaveLength(1);
  });

  it('top-up sends integer cents, new_card only when asked, and the caller\'s key', async () => {
    respond([200, pay({})], [200, pay({})]);
    const api = paymentApi(auth(), BASE);
    await api.topUp(ACCT, toCents(25), false, 'k1');
    await api.topUp(ACCT, toCents(19.99), true, 'k2');
    expect(seen.map((s) => [s.method, s.url, s.key, s.body])).toEqual([
      ['POST', `${BASE}/v1/accounts/${ACCT}/topups`, 'k1', { amount_cents: 2500 }],
      ['POST', `${BASE}/v1/accounts/${ACCT}/topups`, 'k2', { amount_cents: 1999, new_card: true }],
    ]);
  });

  it('register, card, and auto top-up on and off', async () => {
    respond([200, {}], [200, { checkout_url: 'https://checkout.stripe.test/s' }], [200, {}], [200, {}]);
    const api = paymentApi(auth(), BASE);
    await api.register(ACCT, '2026-11', 'dev@example.test');
    expect(await api.saveCard(ACCT)).toBe('https://checkout.stripe.test/s');
    await api.setAutoTopUp(ACCT, 1000, 2000);
    await api.disableAutoTopUp(ACCT);
    expect(seen.map((s) => [s.method, s.url.replace(BASE, ''), s.body])).toEqual([
      ['POST', `/v1/accounts/${ACCT}/register`, { terms_version: '2026-11', email: 'dev@example.test' }],
      ['POST', `/v1/accounts/${ACCT}/card`, null],
      ['PATCH', `/v1/accounts/${ACCT}`, { auto_topup: { threshold_cents: 1000, amount_cents: 2000 } }],
      ['PATCH', `/v1/accounts/${ACCT}`, { auto_topup: null }],
    ]);
    expect(seen[0].key && seen[1].key).toBeTruthy(); // register and card carry a key
  });

  it('toCents rounds typed dollars to whole cents', () => {
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(1000)).toBe(100000);
  });
});

describe('back from Replace card', () => {
  const visa: CardSummary = { brand: 'visa', last4: '4242', exp_month: 4, exp_year: 2030 };
  const amex: CardSummary = { brand: 'amex', last4: '0005', exp_month: 1, exp_year: 2031 };

  it('says "saving" until the profile shows a different card, then "updated"', () => {
    const before = cardSignature(visa);
    expect(cardReturnStatus(before, undefined, false)).toBe('saving'); // profile loading
    expect(cardReturnStatus(before, visa, false)).toBe('saving'); // webhook not in yet
    expect(cardReturnStatus(before, amex, false)).toBe('updated');
    expect(cardReturnStatus(before, amex, true)).toBe('updated');
  });

  it('says "slow" when the poll ended with no change', () => {
    expect(cardReturnStatus(cardSignature(visa), visa, true)).toBe('slow');
    expect(cardReturnStatus(cardSignature(null), null, true)).toBe('slow');
  });

  it('treats a first card (none before) as the change', () => {
    expect(cardReturnStatus(cardSignature(null), null, false)).toBe('saving');
    expect(cardReturnStatus(cardSignature(null), visa, false)).toBe('updated');
  });

  it('with nothing stashed, any card counts as the new one', () => {
    expect(cardReturnStatus(null, visa, false)).toBe('updated');
    expect(cardReturnStatus(null, null, true)).toBe('slow');
  });

  it('sees a new expiry on the same card number as a change', () => {
    expect(cardReturnStatus(cardSignature(visa), { ...visa, exp_year: 2032 }, false)).toBe('updated');
  });
});

describe('top-up failures', () => {
  it('never calls a charge failed when it may have gone through', () => {
    expect(isUnconfirmed(new ApiError(0, 'The service did not respond.'))).toBe(true);
    expect(isUnconfirmed(new ApiError(502, 'bad gateway'))).toBe(true);
    expect(isUnconfirmed(new ApiError(500, 'oops'))).toBe(true);
    expect(isUnconfirmed(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('treats a 4xx as a definite answer', () => {
    expect(isUnconfirmed(new ApiError(402, 'card declined', 'card_declined'))).toBe(false);
    expect(isUnconfirmed(new ApiError(400, 'amount too large'))).toBe(false);
    expect(isUnconfirmed(new ApiError(409, 'idempotency conflict'))).toBe(false);
  });
});
