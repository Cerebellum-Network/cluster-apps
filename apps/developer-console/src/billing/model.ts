// Pure view-model functions: recon's bills → what the screens display.
// Kept free of React so the rules are easy to test and read.
//
// Ported verbatim from billing-console (src/lib/model.ts). The `var(--b-*)`
// colour tokens it returns are defined in billing.css.

import type { Bills, MonthBill, Rates, LedgerEntry } from './api';
import { GIB, money, monthLabel, monthName, num, runway, usd } from './format';

export const n = (s: string | null | undefined) => (s == null ? 0 : Number(s));

/** A month's balance movement, read from the ledger (#190 review: the balance box). */
export type BalanceBox = { opening: number; topups: number; usage: number; closing: number };

/** Opening → top-ups → usage → closing for `month` (YYYY-MM), or null if no entries. */
export function balanceBox(ledger: LedgerEntry[] | null | undefined, month: string): BalanceBox | null {
  if (!ledger || ledger.length === 0) return null;
  const inMonth = ledger.filter((e) => (e.created_at ?? '').slice(0, 7) === month);
  if (inMonth.length === 0) return null;
  const asc = [...inMonth].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  const first = asc[0];
  const last = asc[asc.length - 1];
  const closing = n(last.running_balance_usd);
  const opening = n(first.running_balance_usd) - n(first.amount_usd);
  let topups = 0;
  let usage = 0;
  for (const e of asc) {
    const amt = n(e.amount_usd);
    if (amt >= 0) topups += amt;
    else usage += amt; // debits are negative
  }
  return { opening, topups, usage, closing };
}

/** The whole ledger as CSV (#190 review: Download CSV for the history). */
export function ledgerToCsv(ledger: LedgerEntry[] | null | undefined): string {
  const header = ['Date', 'Type', 'Amount (USD)', 'Balance (USD)', 'Era', 'Reference'];
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = (ledger ?? []).map((e) =>
    [e.created_at, e.entry_type, e.amount_usd, e.running_balance_usd, e.era_id ?? '', e.origin_ref ?? ''].map((c) =>
      esc(String(c)),
    ),
  );
  return [header.map(esc), ...rows].map((r) => r.join(',')).join('\n');
}

/** How a settled month's cost was covered: card top-ups that month vs the balance. */
export function monthFunding(
  ledger: LedgerEntry[] | null | undefined,
  month: string,
  costUsd: number,
): { card: number; fromBalance: number } {
  const box = balanceBox(ledger, month);
  const card = Math.min(box ? box.topups : 0, costUsd);
  return { card, fromBalance: Math.max(costUsd - card, 0) };
}

export function requestsUsd(b: MonthBill): number {
  return n(b.lines.put_usd) + n(b.lines.get_usd);
}

/** Daily spend in USD: month to date over the days settled, else last month's average. */
export function burnPerDay(bills: Bills): number {
  const cur = bills.current_month;
  if (cur.days_covered >= 1) return n(cur.month_to_date_usd) / cur.days_covered;
  const last = bills.months.find((m) => m.month < cur.month);
  if (!last) return 0;
  return n(last.total_usd) / daysInMonth(last.month);
}

export function daysInMonth(yyyymm: string): number {
  const [y, m] = yyyymm.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function previousMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// ── KPIs ──────────────────────────────────────────────────────────────────
export interface Kpi {
  label: string;
  value: string;
  delta?: string;
  deltaColor?: string;
  sub: string;
  emphasis?: boolean;
}

export function kpis(bills: Bills | null, balance: number | null): Kpi[] {
  const empty = !bills || bills.months.length === 0;
  if (empty) {
    return [
      { label: 'Month to date', value: '$0.00', sub: 'no settled usage yet', emphasis: true },
      { label: 'Forecast', value: '—', sub: 'not enough usage yet' },
      { label: 'Last month', value: '—', sub: 'no bill yet' },
      {
        label: 'Balance',
        value: balance == null ? '—' : usd(balance),
        sub: balance ? 'no usage to measure yet' : 'top up to start',
      },
    ];
  }
  const cur = bills.current_month;
  const mtd = n(cur.month_to_date_usd);
  const last = bills.months.find((m) => m.month < cur.month) ?? null;
  const lastTotal = last ? n(last.total_usd) : null;
  const forecast = cur.forecast_usd == null ? null : n(cur.forecast_usd);

  let delta: string | undefined;
  let deltaColor: string | undefined;
  let forecastSub = 'not enough of the month yet';
  if (forecast != null) {
    if (lastTotal) {
      const pct = ((forecast - lastTotal) / lastTotal) * 100;
      delta = `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%`;
      deltaColor = pct >= 0 ? 'var(--b-warn-tx)' : 'var(--b-ok-tx)';
      forecastSub = 'vs last month';
    } else {
      forecastSub = 'at the rate so far';
    }
  }

  const perDay = burnPerDay(bills);
  return [
    {
      label: 'Month to date',
      value: usd(mtd),
      sub: cur.days_covered > 0 ? `${cur.days_covered.toFixed(1)} of ${cur.days_in_month} days settled` : 'no settled usage this month yet',
      emphasis: true,
    },
    { label: 'Forecast', value: forecast == null ? '—' : usd(forecast), delta, deltaColor, sub: forecastSub },
    {
      label: 'Last month',
      value: lastTotal == null ? '—' : usd(lastTotal),
      sub: last ? `${monthName(last.month)}, settled` : 'no bill yet',
    },
    {
      label: 'Balance',
      value: balance == null ? '—' : usd(balance),
      sub: balance == null ? 'loading' : `${runway(balance, perDay).text} at this rate`,
    },
  ];
}

// ── Chart ─────────────────────────────────────────────────────────────────
export interface ChartModel {
  monthLabel: string;
  prevLabel: string;
  daysInMonth: number;
  ymax: number;
  yLabels: string[];
  cur: [number, number][];
  prev: [number, number][];
  forecast: [number, number][] | null;
  today: { x: number; y: number; label: string } | null;
  xLabels: string[];
}

function niceStep(maxVal: number): number {
  if (maxVal <= 0) return 1;
  const raw = maxVal / 3;
  const mag = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= raw) return m * mag;
  return 10 * mag;
}

function axisLabel(v: number, step: number): string {
  if (v === 0) return step >= 1 ? '$0' : '$0.00';
  if (step >= 1) return '$' + Math.round(v).toLocaleString('en-US');
  return usd(v);
}

function cumulative(bills: Bills, month: string, days: number): number[] {
  const daily = new Array<number>(days).fill(0);
  for (const d of bills.days) if (d.date.startsWith(month)) daily[Number(d.date.slice(8, 10)) - 1] += n(d.total_usd);
  let run = 0;
  return daily.map((v) => (run += v));
}

export function chart(bills: Bills): ChartModel {
  const cur = bills.current_month;
  const dim = cur.days_in_month;
  const prevMonth = previousMonth(cur.month);
  const prevDays = daysInMonth(prevMonth);
  const mtd = n(cur.month_to_date_usd);
  const forecast = cur.forecast_usd == null ? null : n(cur.forecast_usd);
  const covered = Math.min(dim, cur.days_covered);

  const curCum = cumulative(bills, cur.month, dim);
  const curPts: [number, number][] = [[0, 0]];
  for (let d = 1; d <= Math.floor(covered); d++) curPts.push([d, curCum[d - 1]]);
  if (covered > Math.floor(covered)) curPts.push([covered, mtd]);

  const prevCum = cumulative(bills, prevMonth, prevDays);
  const prevPts: [number, number][] = [[0, 0], ...prevCum.map((v, i): [number, number] => [((i + 1) * dim) / prevDays, v])];
  const prevTotal = prevCum[prevCum.length - 1] ?? 0;

  const step = niceStep(Math.max(forecast ?? 0, prevTotal, mtd));
  const ymax = step * 3;

  const asOf = new Date(bills.as_of);
  const mShort = asOf.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const monthShort = new Date(Date.UTC(Number(cur.month.slice(0, 4)), Number(cur.month.slice(5, 7)) - 1, 1)).toLocaleDateString(
    'en-US',
    { month: 'short', timeZone: 'UTC' },
  );

  return {
    monthLabel: monthName(cur.month),
    prevLabel: monthName(prevMonth),
    daysInMonth: dim,
    ymax,
    yLabels: [3, 2, 1, 0].map((k) => axisLabel(k * step, step)),
    cur: curPts,
    prev: prevPts,
    forecast: forecast != null && covered < dim ? [[covered, mtd], [dim, forecast]] : null,
    today: covered > 0 ? { x: covered, y: mtd, label: `Today · ${mShort} ${asOf.getUTCDate()}` } : null,
    xLabels: [1, 8, 15, 22, dim].map((d) => `${monthShort} ${d}`),
  };
}

// ── Spend by service ──────────────────────────────────────────────────────
export interface ServiceRow {
  name: string;
  amount: string;
  pct: string;
  width: string;
  color: string;
}

export function services(bills: Bills): { rows: ServiceRow[]; note: string } | null {
  const cur = bills.current_month;
  const thisMonth = bills.months.find((m) => m.month === cur.month && n(m.total_usd) > 0);
  const bill = thisMonth ?? bills.months.find((m) => n(m.total_usd) > 0) ?? bills.months[0];
  if (!bill) return null;
  const raw: [string, number][] = [
    ['Compute', n(bill.lines.compute_usd)],
    ['Data transfer', n(bill.lines.transfer_usd)],
    ['Requests', requestsUsd(bill)],
    ['Storage', n(bill.lines.storage_usd)],
  ];
  // Largest first, as both design samples show; series colours by position.
  const sorted = [...raw].sort((a, b) => b[1] - a[1]);
  const total = raw.reduce((s, r) => s + r[1], 0);
  const max = Math.max(...raw.map((r) => r[1]));
  const colors = ['var(--b-s1)', 'var(--b-s2)', 'var(--b-s3)', 'var(--b-s4)'];
  const pct = (v: number) => {
    if (v === 0 || total === 0) return '0%';
    const p = (v / total) * 100;
    return p < 0.1 ? '<0.1%' : (p >= 10 ? p.toFixed(0) : p.toFixed(1)) + '%';
  };
  return {
    rows: sorted.map(([name, v], i) => ({
      name,
      amount: usd(v),
      pct: pct(v),
      width: v === 0 || max === 0 ? '0%' : `${Math.max(1.5, (v / max) * 100)}%`,
      color: colors[i],
    })),
    note: thisMonth
      ? `${monthLabel(bill.month)}, month to date`
      : `${monthLabel(bill.month)} · no usage this month yet, showing the latest month`,
  };
}

// ── Bill detail (per-month line items) ──────────────────────────────────────
// Ported from billing-console (pages/bills/BillDetail.tsx): the pure functions
// that turn a MonthBill + the cluster's on-chain Rates into display sections.
export interface LineRow {
  item: string;
  sub: string;
  used: string;
  rate: string;
  amount: string;
}
export interface BillSection {
  title: string;
  amount: string;
  rows: LineRow[];
  note?: string;
}

const perUnit = (price: number, unit: string, scale = 1) => `${usd(price * scale)} / ${unit}`;

/**
 * The rate behind a line: the cluster's on-chain price when recon has published
 * it, else amount ÷ quantity (which says nothing for a line with nothing used,
 * hence "—").
 */
function rate(chainPrice: number | null, amount: number, quantity: number, unit: string, scale = 1): string {
  if (chainPrice != null) return perUnit(chainPrice, unit, scale);
  if (!quantity) return '—';
  return perUnit(amount / quantity, unit, scale);
}

/**
 * Compute is billed as one amount over three resources (CPU, RAM and GPU, each
 * with its own on-chain price). Each row's share is units × price, scaled so the
 * rows add up to the amount billed. Without prices the split is only known when a
 * single resource was used.
 */
function computeRows(b: MonthBill, rates: Rates | null): LineRow[] {
  const compute = n(b.lines.compute_usd);
  const res = [
    { item: 'GPU', units: n(b.usage.gpu_units), unit: 'unit', label: 'units', price: rates ? n(rates.gpu_usd_per_unit) : null },
    { item: 'CPU', units: n(b.usage.cpu_units), unit: 'CPU-s', label: 'CPU-s', price: rates ? n(rates.cpu_usd_per_unit) : null },
    { item: 'RAM', units: n(b.usage.ram_units), unit: 'GB-s', label: 'GB-s', price: rates ? n(rates.ram_usd_per_unit) : null },
  ];
  const weights = res.map((r) => (r.price == null ? null : r.units * r.price));
  const sum = weights.every((w) => w != null) ? (weights as number[]).reduce((a, w) => a + w, 0) : null;
  const used = res.filter((r) => r.units > 0);
  return res.map((r, i) => {
    let amount: string;
    if (sum != null && sum > 0) amount = money((compute * weights[i]!) / sum);
    else if (r.units === 0) amount = '$0.00';
    else if (used.length === 1) amount = money(compute);
    else amount = '—';
    const alone = used.length === 1 && used[0] === r;
    return {
      item: r.item,
      sub: '',
      used: `${num(r.units)} ${r.label}`,
      rate: rate(r.price, alone ? compute : 0, alone ? r.units : 0, r.unit),
      amount,
    };
  });
}

/** The four billed sections for one month, each with its line rows. */
export function billSections(b: MonthBill, rates: Rates | null): BillSection[] {
  const u = b.usage;
  const compute = n(b.lines.compute_usd);
  const storage = n(b.lines.storage_usd);
  const transfer = n(b.lines.transfer_usd);
  const put = n(b.lines.put_usd);
  const get = n(b.lines.get_usd);
  const gibMonths = n(u.stored_byte_months) / GIB;
  const gib = n(u.transferred_bytes) / GIB;
  const writes = n(u.put_requests);
  const reads = n(u.get_requests);
  // The chain prices storage and transfer per MiB; the bill shows GiB.
  const chain = (v: string | undefined, scale = 1) => (rates && v != null ? n(v) * scale : null);
  return [
    {
      title: 'Compute',
      amount: money(compute),
      note: 'Includes inference: models turn tokens into GPU units, and the cluster prices GPU units.',
      rows: computeRows(b, rates),
    },
    {
      title: 'Storage',
      amount: money(storage),
      rows: [
        {
          item: 'Held',
          sub: 'bytes held × the fraction of the month held',
          used: `${num(gibMonths)} GiB-month`,
          rate: rate(chain(rates?.storage_usd_per_mib_month, 1024), storage, gibMonths, 'GiB-month'),
          amount: money(storage),
        },
      ],
    },
    {
      title: 'Data transfer',
      amount: money(transfer),
      rows: [
        {
          item: 'Out',
          sub: '',
          used: `${num(gib)} GiB`,
          rate: rate(chain(rates?.transfer_usd_per_mib, 1024), transfer, gib, 'GiB'),
          amount: money(transfer),
        },
      ],
    },
    {
      title: 'Requests',
      amount: money(requestsUsd(b)),
      rows: [
        { item: 'Writes', sub: '', used: num(writes, 0), rate: rate(chain(rates?.put_usd_per_request), put, writes, 'M', 1e6), amount: money(put) },
        { item: 'Reads', sub: '', used: num(reads, 0), rate: rate(chain(rates?.get_usd_per_request), get, reads, 'M', 1e6), amount: money(get) },
      ],
    },
  ];
}
