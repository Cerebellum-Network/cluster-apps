// Pure view-model functions: recon's bills → what the screens display.
// Kept free of React so the rules are easy to test and read.

import type { Bills, MonthBill } from './api';
import { monthLabel, monthName, runway, usd } from '../lib/format';

export const n = (s: string | null | undefined) => (s == null ? 0 : Number(s));

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
