/**
 * Wire types of the public compute API (the compute gateway, `/v1`), from the
 * sandbox contract: ddc-node `docs/compute/sandboxes/API.md` (build design,
 * Section 3). JSON is snake_case; times are RFC 3339 UTC; durations are integer
 * seconds (`*_s`) or milliseconds (`*_ms`).
 *
 * Everything here is what the gateway sends; nothing is computed in the browser.
 */

/** `unknown`: the node has been silent for longer than the cluster allows; not terminal. */
export type SandboxStatus = 'starting' | 'running' | 'terminated' | 'failed' | 'unknown';

/** The live statuses: the sandbox holds its node's capacity. */
export const LIVE_STATUSES: readonly SandboxStatus[] = ['starting', 'running', 'unknown'];
export const isLive = (s: SandboxStatus): boolean => LIVE_STATUSES.includes(s);

export type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

export interface Resources {
  cpu: number;
  memory_mib: number;
  pids?: number;
  /** Accepted, not enforced. */
  disk_mib?: number;
  /** Must be null in v1. */
  gpu?: null;
}

/** One egress rule. `credential` names a secret the egress proxy injects; the sandbox never sees it. */
export interface EgressRule {
  /** Exact host, or `*.suffix`. */
  host: string;
  /** Upper case. */
  methods: HttpMethod[];
  path_prefix?: string;
  credential?: string;
}

export interface EgressPolicy {
  allow: EgressRule[];
}

/** `POST /v1/sandboxes` body. */
export interface CreateSandboxRequest {
  image: string;
  /** Defaults to `["sleep","infinity"]`. */
  command?: string[];
  runtime?: 'gvisor';
  workdir?: string;
  resources: Resources;
  /** Default 600. */
  timeout_s?: number;
  /** 0 = off. Idle = no exec and no file call in flight. */
  idle_timeout_s?: number;
  /** Non-secret by rule: stored only on the node; only its keys are reported back. */
  env?: Record<string, string>;
  egress?: EgressPolicy;
  /** ≤ 32 pairs. The `cere.` prefix is reserved for the client-side agent layer. */
  labels?: Record<string, string>;
}

/** What the node measures for a sandbox (live while it runs, final after). */
export interface Usage {
  wall_s: number;
  cpu_s: number;
  memory_peak_mib: number;
  memory_mib_s: number;
  ram_gib_s: number;
  gpu_s: number;
  net_egress_bytes: number;
  net_ingress_bytes: number;
  disk_peak_mib: number;
}

export interface Sandbox {
  id: string;
  status: SandboxStatus;
  bucket: number;
  /** The node's ID: 64 lowercase hex characters, the Ed25519 public key of its seed. */
  node: string;
  runtime: string;
  image: string;
  command: string[];
  workdir: string;
  resources: Resources;
  timeout_s: number;
  idle_timeout_s: number;
  env_keys: string[];
  egress: EgressPolicy;
  labels: Record<string, string>;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  startup_ms: number | null;
  /**
   * `terminated by API[: reason]`, `timeout (Ns)`, `idle_timeout (Ns)`,
   * `oom_killed`, `exited with code N`, `failed: <stage> <detail>`,
   * `lost: runtime restarted`, `lost: host restarted`.
   */
  exit_reason: string | null;
  exit_code: number | null;
  /** Paths kept after termination; readable with `GET /files` until the node's retain TTL. */
  retained: string[];
  usage: Usage;
}

export interface ExecRequest {
  command: string[];
  stdin?: string | null;
  timeout_s?: number;
  workdir?: string;
  env?: Record<string, string>;
}

export interface ExecResult {
  exit_code: number;
  stdout: string;
  stderr: string;
  duration_ms: number;
  timed_out: boolean;
}

export interface ExecExit {
  exit_code: number;
  duration_ms: number;
  timed_out: boolean;
}

/** `POST /v1/sandboxes/{id}/exec?stream=1` events. */
export type ExecEvent =
  | { type: 'stdout'; data: string }
  | { type: 'stderr'; data: string }
  | { type: 'exit'; exit: ExecExit };

/** `GET /v1/sandboxes/{id}/logs` events: the main process's output, then `end`. */
export type LogEvent = { type: 'stdout' | 'stderr'; data: string } | { type: 'end' };

export interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

export interface SecretSummary {
  name: string;
  type: 'header';
  header: string;
  created_at: string;
  updated_at: string;
}

/** `PUT /v1/secrets/{name}` body. Write-only: the value is never returned or logged. */
export interface SecretInput {
  type: 'header';
  header: string;
  value: string;
}

/** `^[a-z0-9][a-z0-9-]{0,62}$` */
export const SECRET_NAME_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

export type EgressDecision = 'allowed' | 'denied' | 'error';

export interface EgressEntry {
  id: number;
  ts: string;
  bucket: number;
  sandbox_id: string | null;
  node: string | null;
  host: string;
  /** `CONNECT` for a host refused before any request was made. */
  method: string;
  /** Never includes the query string; null for a CONNECT refusal. */
  path: string | null;
  status: number | null;
  decision: EgressDecision;
  reason: string | null;
  credential: string | null;
  bytes_up: number;
  bytes_down: number;
  duration_ms: number | null;
}

export type DacStatus = 'pending' | 'pushed' | 'failed';

/**
 * One usage record a node wrote for a sandbox: one per wall-clock minute plus a
 * final one at exit. `cpu_units`/`ram_units` are what the signed DAC record
 * carries (× 1e11), as decimal strings because they exceed JavaScript's safe
 * integer range.
 */
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
  dac_status: DacStatus;
  dac_updated_at: string | null;
}

export const EMPTY_USAGE: Usage = {
  wall_s: 0,
  cpu_s: 0,
  memory_peak_mib: 0,
  memory_mib_s: 0,
  ram_gib_s: 0,
  gpu_s: 0,
  net_egress_bytes: 0,
  net_ingress_bytes: 0,
  disk_peak_mib: 0,
};
