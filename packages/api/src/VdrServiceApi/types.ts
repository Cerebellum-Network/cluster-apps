export interface CustomerEraRecord {
  era_id: number;
  transferred_bytes: number;
  stored_bytes: number;
  gets: number;
  puts: number;
  computes: number;
  cpu_units: string;
  gpu_units: string;
  ram_units: string;
  charge: string;
  time_start: number;
  time_end: number;
}

export type MetricKey = 'charge' | 'cpu_units' | 'gpu_units' | 'ram_units' | 'gets' | 'puts' | 'transferred_bytes';

export type EraRangePreset = 'last_week' | 'last_month' | 'last_3_months' | 'last_6_months' | 'all_time';

export interface TableRowData extends CustomerEraRecord {
  usageDelta: number | null;
}

export interface CustomerErasParams {
  from?: number;
  to?: number;
  timeFrom?: number;
  timeTo?: number;
}

export const METRIC_LABELS: Record<MetricKey, string> = {
  charge: 'Amount Charged ($)',
  cpu_units: 'CPU Units',
  gpu_units: 'GPU Units',
  ram_units: 'RAM Units',
  gets: 'GETs',
  puts: 'PUTs',
  transferred_bytes: 'Transferred Bytes',
};

export const ERA_RANGE_LABELS: Record<EraRangePreset, string> = {
  last_week: 'Last Week',
  last_month: 'Last Month',
  last_3_months: 'Last 3 Months',
  last_6_months: 'Last 6 Months',
  all_time: 'All Time',
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const ERA_RANGE_OFFSETS: Record<EraRangePreset, number | null> = {
  last_week: 7 * DAY_MS,
  last_month: 30 * DAY_MS,
  last_3_months: 90 * DAY_MS,
  last_6_months: 180 * DAY_MS,
  all_time: null,
};

// --- Provider types ---

export interface QoSLatency {
  p50: number;
  p95: number;
  p99: number;
}

export interface QoSAvailability {
  uptime_percent: number;
}

export interface QoSBandwidth {
  mbps: number;
}

export interface ProviderEraRecord {
  era_id: number;
  transferred_bytes: number;
  stored_bytes: number;
  gets: number;
  puts: number;
  computes: number;
  cpu_units: string;
  gpu_units: string;
  ram_units: string;
  latency: QoSLatency | null;
  availability: QoSAvailability | null;
  bandwidth: QoSBandwidth | null;
  reward: string;
  time_start: number;
  time_end: number;
}

export type ProviderMetricKey =
  | 'reward'
  | 'cpu_units'
  | 'gpu_units'
  | 'ram_units'
  | 'gets'
  | 'puts'
  | 'transferred_bytes';

export interface ProviderTableRowData extends ProviderEraRecord {
  rewardDelta: number | null;
}

export interface ProviderErasParams {
  from?: number;
  to?: number;
  timeFrom?: number;
  timeTo?: number;
}

export const PROVIDER_METRIC_LABELS: Record<ProviderMetricKey, string> = {
  reward: 'Reward Earned ($)',
  cpu_units: 'CPU Units',
  gpu_units: 'GPU Units',
  ram_units: 'RAM Units',
  gets: 'GETs',
  puts: 'PUTs',
  transferred_bytes: 'Transferred Bytes',
};
