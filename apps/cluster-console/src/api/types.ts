/**
 * Wire types of the console backend (ddc-node `cluster/console-backend`,
 * DESIGN 3.3 plus the additive routes in contract-changes.md). Field names are
 * the wire's snake_case.
 */

/** A source that did not answer: the console shows it as missing, with why. */
export interface SourceError {
  source: string;
  status?: number;
  detail: string;
}

export interface Cluster {
  id: string;
  name: string;
}

export type Role = 'manager' | 'provider';

export interface SessionInfo {
  session?: string;
  account: string;
  roles: Role[];
  /** How the manager role was granted: on the blockchain, or by backend config (devnet). */
  manager_source?: 'blockchain' | 'backend_config';
  provider_nodes?: string[];
  expires_at: string;
  cluster: Cluster;
}

export interface Challenge {
  challenge_id: string;
  message: string;
  expires_at: string;
}

export interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

export interface Capacity {
  cpu: number;
  memory_mib: number;
}

export interface Alloc {
  allocatable: number;
  allocated: number;
}

export type Counts = Record<string, number>;

export interface Section {
  source: string;
  missing?: SourceError;
  truncated?: boolean;
}

export interface Summary {
  nodes: number | null;
  nodes_healthy: number | null;
  sandboxes_running: number | null;
  cpu: Alloc | null;
  memory_mib: Alloc | null;
  egress_last_hour: Counts | null;
  records_last_hour: Counts | null;
  compute_nodes: number | null;
  compute_nodes_by_module: Counts | null;
  chain_nodes: number | null;
  chain_nodes_by_mode: Counts | null;
  sections: {
    sandbox_nodes: Section;
    sandboxes: Section;
    egress: Section;
    records: Section;
    registry: Section;
    chain: Section;
  };
  generated_at: string;
  last_hour_since: string;
}

export interface ChainNode {
  pub_key: string;
  provider: string;
  host: string;
  http_port: number;
  mode: 'full' | 'storage' | 'cache' | 'compute' | string;
}

export interface ChainSnapshot {
  cluster_id: string;
  manager: string;
  reserve: string;
  nodes: ChainNode[];
  read_at: string;
  extra_managers: string[];
}

export interface SandboxRuntime {
  status?: string;
  endpoint?: string;
  arch?: string;
  kernel?: string;
  runsc?: string;
  runtimes: string[];
  allocatable: Capacity | null;
  allocated: Capacity | null;
  reported_allocated: Capacity | null;
  sandboxes: { running: number; total: number } | null;
  disk_free_gib: number | null;
}

export interface InferenceModel {
  name: string;
  version: string;
  bucket: string;
  status: string;
  ceiling: number | null;
  in_flight: number | null;
  queue: number | null;
}

export interface Device {
  model: string;
  vram_total_bytes: number;
  vram_used_bytes: number;
}

export interface NodeView {
  id: string;
  host: string;
  healthy: boolean;
  last_seen: string;
  modules: string[];
  runtimes: string[];
  sandbox: SandboxRuntime | null;
  inference: { status?: string; provider?: string; devices: Device[]; models: InferenceModel[] } | null;
  agent: { status?: string; isolates_busy: number | null; isolates_warm: number | null } | null;
  chain: ChainNode | null;
}

export interface NodesView {
  items: NodeView[];
  missing: SourceError[];
}

export interface ModelOnNode {
  node: string;
  host: string;
  healthy: boolean;
  status: string;
  ceiling: number | null;
  in_flight: number | null;
  queue: number | null;
}

export interface ModelView {
  model: string;
  version: string;
  bucket: string;
  nodes: ModelOnNode[];
  ceiling: number;
  in_flight: number;
  queue: number;
}

export interface InferenceView {
  models: ModelView[];
  missing: SourceError[];
}

export interface EgressRule {
  host: string;
  methods?: string[];
  path_prefix?: string;
  credential?: string;
}

export interface Usage {
  wall_s: number;
  cpu_s: number;
  memory_peak_mib: number;
  memory_mib_s?: number;
  ram_gib_s: number;
  gpu_s?: number;
  net_egress_bytes: number;
  net_ingress_bytes: number;
  disk_peak_mib: number;
  /** Additive, present only from runtimes that bill on the reservation. */
  billed_cpu_s?: number;
  billed_ram_gib_s?: number;
}

export interface PlacementCandidate {
  node: string;
  free_cpu: number;
  free_memory_mib: number;
  /** RM's ranking: memory left after placement (MiB); -1 when the sandbox does not fit. */
  score: number;
  /** Recorded by RM when present (requested additively): whether it fitted and, if not, why. */
  fits?: boolean;
  reason?: string;
}

export interface PlacementAttempt {
  node: string;
  result: 'accepted' | 'rejected' | 'error' | string;
  detail?: string | null;
  at?: string;
}

export interface Placement {
  decided_at: string;
  candidates: PlacementCandidate[];
  attempts: PlacementAttempt[];
  /** Optional: RM may name the rule it applied. */
  rule?: string;
}

export type SandboxStatus = 'starting' | 'running' | 'terminated' | 'failed' | 'unknown';

export interface Sandbox {
  id: string;
  status: SandboxStatus | string;
  bucket: number;
  node: string | null;
  node_endpoint?: string;
  owner?: string;
  runtime: string;
  image: string;
  command?: string[];
  workdir?: string;
  resources: { cpu: number; memory_mib: number; pids?: number; disk_mib?: number; gpu?: unknown };
  timeout_s: number;
  idle_timeout_s?: number;
  env_keys?: string[];
  egress?: { allow: EgressRule[] };
  labels?: Record<string, string>;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  startup_ms: number | null;
  exit_reason: string | null;
  exit_code: number | null;
  retained?: string[];
  usage?: Usage | null;
  placement?: Placement | null;
}

export interface EgressEntry {
  id: number;
  ts: string;
  bucket: number | null;
  sandbox_id: string | null;
  node: string | null;
  host: string;
  method: string;
  path: string | null;
  status: number | null;
  decision: 'allowed' | 'denied' | 'error' | string;
  reason: string | null;
  credential: string | null;
  bytes_up: number;
  bytes_down: number;
  duration_ms: number | null;
}

export interface UsageRecord {
  record_id: string;
  sandbox_id: string;
  node: string;
  bucket: number;
  period_start: string;
  period_end: string;
  final: boolean;
  exit_reason: string | null;
  cpu_s: number;
  ram_gib_s: number;
  memory_peak_mib: number;
  net_egress_bytes: number;
  net_ingress_bytes: number;
  disk_peak_mib: number;
  cpu_units: string;
  ram_units: string;
  tca_id: number;
  dac_status: 'pending' | 'pushed' | 'failed' | string;
  dac_updated_at: string | null;
  dac_error?: string | null;
  /** Additive, from runtimes that bill on the reservation: present only when the record carries them. */
  wall_s?: number;
  reserved_cpu?: number;
  reserved_memory_mib?: number;
  billed_cpu_s?: number;
  billed_ram_gib_s?: number;
  billing_basis?: string;
}

export interface SourceRow {
  screen: string;
  field: string;
  kind: 'blockchain' | 'resource-manager' | 'egress-proxy' | 'dac' | 'console-backend' | 'missing';
  component?: string;
  route?: string;
  table?: string;
  note?: string;
}

/** One DAC aggregate, in DAC's own units (bytes, request counts, signed cpu/ram/gpu units). */
export interface DACUsage {
  puts: number;
  gets: number;
  stored_bytes: number;
  transferred_bytes: number;
  cpu_units: number;
  ram_units: number;
  gpu_units: number;
  compute_count: number;
}

/** One era from the cluster's DAC grouping collector. */
export interface DACEra {
  id: number;
  /** As DAC names it: ERA_IN_PROGRESS, ERA_EMPTY, ERA_PROCESSED, ERA_INSPECTED, ERA_PAID, ERA_FORCED_SKIPPED. */
  status: string;
  start: string;
  end: string;
  customers: number;
  providers: number;
  /** Customers' consumed usage (what payouts charge); null when the era's EHD was not read. */
  consumed: DACUsage | null;
  /** Providers' provided usage (what payouts reward). */
  provided: DACUsage | null;
  missing?: SourceError;
}

/** GET /api/v1/dac. */
export interface DACView {
  collector: { key: string; url: string; from: 'blockchain' | 'backend_config' | string };
  hours: number;
  since: string;
  eras: DACEra[];
  consumed: DACUsage;
  provided: DACUsage;
  /** Provided usage per node key (hex) over the eras read. */
  nodes: Record<string, DACUsage>;
  truncated: boolean;
  kept_since: string;
  read_at: string;
}
