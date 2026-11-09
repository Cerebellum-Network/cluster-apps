// Number and text formatting, per the handoff's "Number formatting" section.
// Every amount on this network can be a fraction of a cent, so `usd` switches
// to three significant figures below $0.01 and never uses scientific notation.

export function usd(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '$0.00';
  const sign = n < 0 ? '−' : '';
  const a = Math.abs(n);
  if (a >= 0.01) {
    return sign + '$' + a.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  const d = Math.ceil(-Math.log10(a)) + 2; // 3 significant figures
  return sign + '$' + a.toFixed(d).replace(/0+$/, '');
}

/**
 * A running balance. Whole cents read like any amount ("$236.50"), but a
 * balance carrying sub-cent usage keeps up to six decimals ("$199.997914"):
 * rounded to cents, every row after a $0.00003 usage charge would show the
 * same "$200.00" and the change would look like it never happened.
 */
export function usdBalance(v: number | string | null | undefined): string {
  const n = typeof v === 'string' ? Number(v) : v;
  if (n == null || !Number.isFinite(n)) return '—';
  const cents = Math.round(n * 100) / 100;
  if (Math.abs(n - cents) < 5e-7) return usd(cents);
  const sign = n < 0 ? '−' : '';
  return sign + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

/** "+$20.00" for credits, "−$0.81" for debits. */
export function signedUsd(v: number): string {
  return v > 0 ? '+' + usd(v) : usd(v);
}

/** First 8 + "…" + last 8 characters (keys and addresses alike). */
export function short(s: string | null | undefined, head = 8, tail = 8): string {
  if (!s) return '';
  return s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s;
}

/** Whole or decimal counts with thousands separators; small values keep 3 significant figures. */
export function num(v: number | string, maxFraction = 1): string {
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isFinite(n) || n === 0) return '0';
  const a = Math.abs(n);
  if (a >= 1 || maxFraction === 0) {
    return n.toLocaleString('en-US', { maximumFractionDigits: maxFraction });
  }
  return plainSmall(n);
}

/** A small positive number as plain decimals with 3 significant figures. */
export function plainSmall(n: number): string {
  if (n === 0) return '0';
  const d = Math.min(20, Math.ceil(-Math.log10(Math.abs(n))) + 2);
  return n.toFixed(d).replace(/0+$/, '').replace(/\.$/, '');
}

export const GIB = 1024 ** 3;

/** Model token counts: "182.4M", "41.7K". */
export function compact(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(Math.round(n));
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-09" → "September 2026". */
export function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "2026-09" → "September". */
export function monthName(yyyymm: string): string {
  return MONTHS[Number(yyyymm.split('-')[1]) - 1];
}

/** "Oct 8" */
export function shortDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** "Oct 7, 2026" */
export function longDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** Runway text for a balance at a daily burn: "about 4 months", "about 3 days". */
export function runway(balance: number, perDay: number): { text: string; days: number } {
  if (perDay <= 0) return { text: 'more than 12 months', days: Infinity };
  const days = balance / perDay;
  if (days < 1) return { text: 'less than a day', days };
  if (days < 60) return { text: `about ${Math.round(days)} day${Math.round(days) === 1 ? '' : 's'}`, days };
  const months = days / 30.44;
  if (months > 12) return { text: 'more than 12 months', days };
  return { text: `about ${Math.round(months)} months`, days };
}

/** Card brand as the payment provider reports it → display name. */
export function brandName(brand: string | null | undefined): string {
  const b = (brand ?? '').toLowerCase();
  if (b === 'visa') return 'Visa';
  if (b === 'mastercard') return 'Mastercard';
  if (b === 'amex' || b === 'american_express') return 'Amex';
  return brand ? brand[0].toUpperCase() + brand.slice(1) : 'Card';
}
