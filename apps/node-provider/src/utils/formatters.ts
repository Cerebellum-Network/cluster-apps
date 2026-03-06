import type { ProviderMetricKey } from '@cluster-apps/api';

const integerFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const currencyFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const deltaFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
  signDisplay: 'always',
});

const SUPERSCRIPT: Record<string, string> = {
  '-': '⁻',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
};

function toSuperscript(n: number): string {
  return String(n)
    .split('')
    .map((c) => SUPERSCRIPT[c] ?? c)
    .join('');
}

function formatSmallValue(num: number): string {
  const exponent = Math.floor(Math.log10(Math.abs(num)));
  const mantissa = num / Math.pow(10, exponent);
  return `${decimalFormatter.format(mantissa)}×10${toSuperscript(exponent)}`;
}

export function computeScaleFactor(values: number[]): { exponent: number; divisor: number; label: string } {
  const maxAbs = Math.max(...values.map(Math.abs));
  if (maxAbs === 0 || maxAbs >= 0.01) return { exponent: 0, divisor: 1, label: '' };
  const exponent = Math.floor(Math.log10(maxAbs));
  const divisor = Math.pow(10, exponent);
  return { exponent, divisor, label: ` (×10${toSuperscript(exponent)})` };
}

export function formatInteger(value: number): string {
  return integerFormatter.format(value);
}

export function formatDecimal(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num === 0) return '0';
  if (Math.abs(num) >= 0.01) return decimalFormatter.format(num);
  return formatSmallValue(num);
}

export function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num === 0) return '$0';
  if (Math.abs(num) >= 0.01) return `$${currencyFormatter.format(num)}`;
  return `$${formatSmallValue(num)}`;
}

export function formatDelta(value: number | null): string {
  if (value === null) return '—';
  return `${deltaFormatter.format(value)}%`;
}

export function formatMetricValue(value: string | number, metric: ProviderMetricKey): string {
  switch (metric) {
    case 'reward':
      return formatCurrency(value);
    case 'cpu_units':
    case 'gpu_units':
    case 'ram_units':
      return formatDecimal(value);
    case 'gets':
    case 'puts':
    case 'transferred_bytes':
      return formatInteger(typeof value === 'string' ? parseFloat(value) : value);
  }
}
