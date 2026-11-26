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

/** vCPU and MiB of memory. */
export interface Capacity {
  cpu: number;
  memory: number;
}

/**
 * A sandbox's request and limit. `cpu` (vCPU) and `memory` (MiB) are the
 * request: what the node's sandbox quota counts, and the billing floor.
 * `cpu_limit` and `memory_limit` are the most it can use (use above the
 * request is burst, billed as used). A limit that is missing or below the
 * request is the request (`limitsOf`).
 */
export interface SandboxResources extends Capacity {
  cpu_limit?: number | null;
  memory_limit?: number | null;
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
  /** MiB. */
  memory: Alloc | null;
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
  /** Additive, present only from runtimes that record a billing basis: `request_or_usage`, `reserved` (older) or `measured`. */
  billing_basis?: string;
  /** The request over the time it ran: the billing floor. */
  reserved_cpu_s?: number;
  reserved_ram_gib_s?: number;
  billed_cpu_s?: number;
  billed_ram_gib_s?: number;
  /** The part of billed above the request (filled by the backend for older usage). */
  burst_cpu_s?: number;
  burst_ram_gib_s?: number;
  /** Highest per-second vCPU over the sandbox's life, from runtimes with limits. */
  cpu_peak?: number;
  /** `cpu_s` / `wall_s`: the average vCPU it used. */
  cpu_avg?: number;
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

/**
 * A sandbox's image: the reference as created and, once its node has it, its
 * registry digest, its size on the node, whether it was already there
 * (`cached`) and how long getting it took (`pull_ms`, 0 when cached).
 */
export interface SandboxImage {
  ref: string;
  digest: string | null;
  size_bytes: number | null;
  cached: boolean | null;
  pull_ms: number | null;
}

/** The class of a sandbox's `exit_reason`. */
export type ExitKind =
  | 'main_exited'
  | 'timeout'
  | 'idle_timeout'
  | 'oom'
  | 'memory_reclaimed'
  | 'disk_limit'
  | 'insufficient_balance'
  | 'terminated'
  | 'failed'
  | 'lost';

/** Files a sandbox asked at create to keep after it ends. */
export interface Retain {
  paths: string[];
  on: 'any' | 'failure';
  ttl_s: number;
}

/** A file kept after the sandbox ended, with its size in bytes. */
export interface RetainedFile {
  path: string;
  size: number;
}

/** An asked-for path (or a file under it) that was not kept, and why. */
export interface NotRetained {
  path: string;
  reason: string;
}

export interface Sandbox {
  id: string;
  status: SandboxStatus | string;
  bucket: number;
  node: string | null;
  node_endpoint?: string;
  owner?: string;
  runtime: string;
  image: SandboxImage;
  command?: string[];
  workdir?: string;
  /** `disk` in MiB. */
  resources: SandboxResources & { pids?: number; disk?: number; gpu?: unknown };
  timeout_s: number;
  idle_timeout_s?: number;
  env_keys?: string[];
  egress?: { allow: EgressRule[] };
  labels?: Record<string, string>;
  created_at: string;
  /** The container started; billing starts. */
  started_at: string | null;
  /** The node had it running and announced it. */
  ready_at: string | null;
  ended_at: string | null;
  startup_ms: number | null;
  exit_reason: string | null;
  exit_kind: ExitKind | null;
  exit_code: number | null;
  retain: Retain | null;
  retained: RetainedFile[];
  not_retained: NotRetained[];
  /** Retained files are readable until then. */
  retained_until: string | null;
  /** The name of the registry secret its image was pulled with. */
  registry_credential: string | null;
  idempotency_key: string | null;
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
  /** `policy`: a rule added to or removed from a running sandbox's allow-list (an event, not a request). */
  decision: 'allowed' | 'denied' | 'error' | 'policy' | string;
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
  reserved_cpu_s?: number;
  reserved_ram_gib_s?: number;
  billed_cpu_s?: number;
  billed_ram_gib_s?: number;
  /** `request_or_usage`, `reserved` (older) or `measured`: how the units were reached. */
  billing_basis?: string;
  /** The sandbox's limits: vCPU and MiB. */
  cpu_limit?: number;
  memory_limit?: number;
  burst_cpu_s?: number;
  burst_ram_gib_s?: number;
  cpu_peak?: number;
  /** The sandbox's labels. */
  labels?: Record<string, string>;
}

export interface SourceRow {
  screen: string;
  field: string;
  kind: 'blockchain' | 'resource-manager' | 'egress-proxy' | 'dac' | 'metrics' | 'console-backend' | 'missing';
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

/** Sandbox usage records summed, in their own units: CPU-seconds and GiB-seconds. */
export interface UsageAmounts {
  records: number;
  cpu_s: number;
  ram_gib_s: number;
  billed_cpu_s: number;
  billed_ram_gib_s: number;
  /** Records with no billed figures (older runtimes): their billed share is unknown, not zero. */
  without_billed: number;
  /** Billed = floor + burst: billed for the request, and above it. Absent from a backend before limits. */
  floor_cpu_s?: number;
  floor_ram_gib_s?: number;
  burst_cpu_s?: number;
  burst_ram_gib_s?: number;
}

export type BillingState = 'counted' | 'waiting' | 'not_counted' | 'unknown';

export interface UsagePoint extends UsageAmounts {
  start: string;
}

/** One DAC era's sandbox usage: the records whose period ends in it. */
export interface UsageByEra extends UsageAmounts {
  era: number;
  start: string;
  end: string;
  status: string;
}

export interface UsageByNode extends UsageAmounts {
  node: string;
  host: string;
  on_chain: boolean;
  billing: BillingState;
  reason: string;
}

export interface UsageByBucket extends UsageAmounts {
  bucket: number;
  sandboxes: number;
  last_active: string;
}

export interface BillingGroup extends UsageAmounts {
  state: BillingState;
  reason: string;
  nodes: string[];
}

/** GET /api/v1/usage?hours=N: the sandbox service's usage over the window. */
export interface UsageView {
  hours: number;
  since: string;
  step_s: number;
  totals: UsageAmounts;
  sandboxes: number;
  series: UsagePoint[];
  /** Oldest first; absent from a backend before limits, empty when DAC is not readable. */
  by_era?: UsageByEra[];
  by_node: UsageByNode[];
  by_bucket: UsageByBucket[];
  billing: BillingGroup[];
  truncated: boolean;
  missing: SourceError[];
  read_at: string;
}

/** A sandbox's use over its latest per-minute usage record. */
export interface LiveUse {
  /** Average vCPU used over the record's minute. */
  cpu: number;
  /** Average memory used, MiB. */
  memory: number;
  memory_peak_mib: number;
  /** The latest minute's highest per-second vCPU, from runtimes with limits. */
  cpu_peak?: number | null;
  period_start: string;
  period_end: string;
  /** "node metrics" (about every 30 s) or "usage record" (the latest minute's record). */
  source: string;
}

export interface LiveSandbox {
  id: string;
  status: string;
  bucket: number;
  node: string;
  image: SandboxImage;
  resources: SandboxResources;
  created_at: string;
  started_at: string | null;
  cpu_s: number | null;
  ram_gib_s: number | null;
  billed_cpu_s: number | null;
  billed_ram_gib_s: number | null;
  /** The part of billed above the request so far; absent from a backend before limits. */
  burst_cpu_s?: number | null;
  burst_ram_gib_s?: number | null;
  billing_basis?: string;
  live: LiveUse | null;
}

export interface LiveNode {
  id: string;
  host: string;
  healthy: boolean | null;
  last_seen: string | null;
  allocatable: Capacity | null;
  allocated: Capacity | null;
  sandboxes: LiveSandbox[];
}

/** GET /api/v1/live: every sandbox node with the sandboxes on it now. */
export interface LiveView {
  nodes: LiveNode[];
  unplaced: LiveSandbox[];
  missing: SourceError[];
  read_at: string;
}
