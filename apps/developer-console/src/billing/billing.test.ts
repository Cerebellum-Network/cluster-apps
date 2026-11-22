import { describe, it, expect } from 'vitest';

import { usd, usdBalance, money, signedMoney, monthLabel, brandName, runway } from './format';
import { kpis, services, burnPerDay, billSections, balanceBox, monthFunding } from './model';
import type { Bills, Rates, LedgerEntry } from './api';
import { ApiError, isUnconfirmed, type CardSummary } from './api';
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

const ledger: LedgerEntry[] = [
  // newest-first, as the endpoint returns it
  { id: '2', entry_type: 'usage_charge', amount_usd: '-2', running_balance_usd: '8', era_id: '1', origin_ref: '', created_at: '2026-11-20T00:00:00Z' },
  { id: '1', entry_type: 'manual_topup', amount_usd: '10', running_balance_usd: '10', era_id: null, origin_ref: '', created_at: '2026-11-05T00:00:00Z' },
];

describe('balanceBox / monthFunding (ledger → balance box)', () => {
  it('opening → top-ups → usage → closing for the month', () => {
    const box = balanceBox(ledger, '2026-11')!;
    expect(box.opening).toBe(0); // 10 (first running balance) − 10 (its amount)
    expect(box.topups).toBe(10);
    expect(box.usage).toBe(-2);
    expect(box.closing).toBe(8);
  });

  it('null for a month with no entries, and for no ledger', () => {
    expect(balanceBox(ledger, '2026-10')).toBeNull();
    expect(balanceBox(null, '2026-11')).toBeNull();
  });

  it('monthFunding splits cost into card vs balance', () => {
    expect(monthFunding(ledger, '2026-11', 2)).toEqual({ card: 2, fromBalance: 0 }); // card covers it
    expect(monthFunding(ledger, '2026-11', 15)).toEqual({ card: 10, fromBalance: 5 }); // card + balance
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
    expect(isUnconfirmed(new ApiError(402, 'card declined'))).toBe(false);
    expect(isUnconfirmed(new ApiError(400, 'amount too large'))).toBe(false);
    expect(isUnconfirmed(new ApiError(409, 'idempotency conflict'))).toBe(false);
  });
});
