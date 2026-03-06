import type { MetricKey } from '@cluster-apps/api';

const integerFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const smallDecimalFormatter = new Intl.NumberFormat(undefined, {
  maximumSignificantDigits: 3,
});

const scientificFormatter = new Intl.NumberFormat(undefined, {
  maximumSignificantDigits: 3,
  notation: 'scientific',
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

export function formatInteger(value: number): string {
  return integerFormatter.format(value);
}

export function formatDecimal(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num === 0) return '0';
  const abs = Math.abs(num);
  if (abs >= 0.01) return decimalFormatter.format(num);
  if (abs >= 1e-6) return smallDecimalFormatter.format(num);
  return scientificFormatter.format(num);
}

export function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return `$${currencyFormatter.format(num)}`;
}

export function formatDelta(value: number | null): string {
  if (value === null) return '—';
  return `${deltaFormatter.format(value)}%`;
}

export function formatMetricValue(value: string | number, metric: MetricKey): string {
  switch (metric) {
    case 'charge':
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
