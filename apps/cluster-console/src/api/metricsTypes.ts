import type { SourceError } from './types';

/**
 * Wire types of the console backend's metrics views (VictoriaMetrics, read
 * only). Every number is nullable: null means no metric answered for it,
 * never zero.
 */

export interface Machine {
  key: string;
  instance: string;
  host: string;
  mode: string;
  on_chain: boolean;
  version: string | null;
  up: boolean | null;
  last_seen: string | null;
  uptime_s: number | null;
  availability_7d: number | null;
  cpu_cores: number | null;
  cpu_used: number | null;
  memory_total_bytes: number | null;
  memory_used_bytes: number | null;
  disk_total_bytes: number | null;
  disk_used_bytes: number | null;
  stored_bytes: number | null;
  served_24h_bytes: number | null;
  requests_per_s: number | null;
  cache_hit_bytes_ratio: number | null;
  cache_hit_requests_ratio: number | null;
}

export interface GPU {
  id: string;
  utilization: number | null;
  memory_used_bytes: number | null;
  memory_total_bytes: number | null;
}

export interface InferenceNodeMetrics {
  node: string;
  version: string | null;
  up: boolean | null;
  last_seen: string | null;
  gpus: GPU[];
}

export interface AgentMetrics {
  pod: string;
  version: string | null;
  up: boolean | null;
  last_seen: string | null;
  slots_used: number | null;
  slots_total: number | null;
  runs_24h: number | null;
}

/** GET /api/v1/fleet. */
export interface FleetView {
  machines: Machine[];
  inference: InferenceNodeMetrics[];
  agents: AgentMetrics[];
  missing: SourceError[];
  read_at: string;
}

export interface Point {
  t: string;
  v: number | null;
}

/** GET /api/v1/storage?days=N: storage nodes only, one point a day. */
export interface StorageView {
  days: number;
  step_s: number;
  series: { t: string; used_bytes: number | null; total_bytes: number | null; stored_bytes: number | null }[];
  missing: SourceError[];
  read_at: string;
}

export interface DeliveryNode {
  key: string;
  instance: string;
  host: string;
  mode: string;
  served_bytes: number | null;
  from_cache_ratio: number | null;
  requests_from_cache_ratio: number | null;
  p95_ms: number | null;
}

/** GET /api/v1/delivery?days=N. */
export interface DeliveryView {
  days: number;
  step_s: number;
  series: {
    t: string;
    served_bytes: number | null;
    from_cache_bytes: number | null;
    from_storage_bytes: number | null;
  }[];
  nodes: DeliveryNode[];
  missing: SourceError[];
  read_at: string;
}

/** GET /api/v1/inference/history?days=N. */
export interface InferenceHistory {
  days: number;
  step_s: number;
  total: {
    peak_in_flight: Point[];
    capacity: Point[];
    refused_model_full: Point[];
    refused_customer_limit: Point[];
    gpu_units: Point[];
  };
  models: {
    model: string;
    capacity: number | null;
    peak_in_flight: number | null;
    refused_model_full: number | null;
    refused_customer_limit: number | null;
    gpu_units: number | null;
  }[];
  missing: SourceError[];
  read_at: string;
}

/** GET /api/v1/sandboxes/:id/metrics?minutes=N. */
export interface SandboxMetrics {
  id: string;
  step_s: number;
  cpu: Point[];
  memory_bytes: Point[];
  missing: SourceError[];
  read_at: string;
}
