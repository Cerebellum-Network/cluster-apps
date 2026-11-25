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

/**
 * A sandbox's CPU and memory. `cpu` and `memory_mib` are the request: guaranteed to it under contention, kept from
 * reclaim, and the least it is billed. `cpu_limit` and `memory_limit_mib` are the most it can use (above the memory
 * limit it is stopped, `oom_killed`). A create may leave the limits out (the cluster's defaults apply); the sandbox
 * reports the limits it got. Gateways before limits send none: then the request is also the limit.
 */
export interface Resources {
  cpu: number;
  /**
   * The memory request in MiB. The API's name is `memory` (the gateway still takes and sends `memory_mib` too); the
   * client sends `memory` and reads either into this field, so the console's code reads one name.
   */
  memory_mib: number;
  cpu_limit?: number;
  /** The memory limit in MiB; the API's name is `memory_limit`, read and sent as `memory_mib` is. */
  memory_limit_mib?: number;
  /** The API's names for the two memory fields, as a gateway with them sends them. */
  memory?: number;
  memory_limit?: number;
  pids?: number;
  /** Accepted, not enforced. */
  disk_mib?: number;
  /** Must be null in v1. */
  gpu?: null;
}

/**
 * One egress rule. A rule uses credentials in one of two ways, never both: `credential` names a secret the egress
 * proxy adds to every request the rule allows (header mode); `placeholders` names the secrets the sandbox may pick
 * per request by writing `cere:<name>` in a header, which the proxy replaces with the secret's header and value
 * (placeholder mode, at most 16). Either way the sandbox never sees a value. A name resolves narrowest first: the
 * sandbox's own secrets, then its agent's, then the bucket's.
 */
export interface EgressRule {
  /** Exact host, or `*.suffix`. */
  host: string;
  /** Upper case, or `*` for any. */
  methods: HttpMethod[];
  path_prefix?: string;
  credential?: string;
  placeholders?: string[];
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
  /** Any field left out gets the cluster's default (request 0.25 vCPU, 256 MiB; limits as `Resources` says). */
  resources?: Partial<Resources>;
  /** Default 600. */
  timeout_s?: number;
  /** 0 = off. Idle = no exec and no file call in flight. */
  idle_timeout_s?: number;
  /** Non-secret by rule: stored only on the node; only its keys are reported back. */
  env?: Record<string, string>;
  egress?: EgressPolicy;
  /** ≤ 32 pairs. The `cere.` prefix is reserved for the client-side agent layer. */
  labels?: Record<string, string>;
  /**
   * The sandbox's own credentials (at most 32): held by the egress proxy for this sandbox only, deleted when it
   * ends, never returned. Rules name them like the bucket's, and they win over a bucket or agent secret of the
   * same name.
   */
  secrets?: SandboxSecretInput[];
}

/** One of a sandbox's own credentials at create: `PUT /v1/secrets`' rules, `hosts` required. */
export interface SandboxSecretInput {
  name: string;
  type: 'header';
  header: string;
  value: string;
  hosts: string[];
}

/** A sandbox's own credential as the sandbox lists it: never its value. */
export interface SandboxSecret {
  name: string;
  type: 'header';
  header: string;
  hosts: string[];
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
  /**
   * What the sandbox is billed on: `request_or_usage` (each second, the larger of its request and what it used),
   * `reserved` (older: its `resources` × `wall_s`, or the measured amount where that is more, per minute),
   * `measured`, or `''` until the node has reported usage. The billing fields are absent from gateways that predate
   * them.
   */
  billing_basis?: BillingBasis | '';
  /** `resources.cpu` × `wall_s`: the guaranteed floor. */
  reserved_cpu_s?: number;
  /** `resources.memory_mib` / 1024 × `wall_s`: the guaranteed floor. */
  reserved_ram_gib_s?: number;
  /** What is billed; includes the open period while the sandbox runs. */
  billed_cpu_s?: number;
  billed_ram_gib_s?: number;
  /** Billed above the request (`billed − reserved`, 0 under `measured`). Absent before limits. */
  burst_cpu_s?: number;
  burst_ram_gib_s?: number;
  /** The highest per-second CPU use, in cores. Absent before limits. */
  cpu_peak?: number;
}

/**
 * The node's billing basis, as each usage and record says it: `request_or_usage` (now), `reserved` (records and
 * runtimes before limits), `measured`.
 */
export type BillingBasis = 'request_or_usage' | 'reserved' | 'measured';

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
  /** Its own credentials, without values; absent when it was created without any (and from older gateways). */
  secrets?: SandboxSecret[];
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  startup_ms: number | null;
  /**
   * `terminated by API[: reason]`, `timeout (Ns)`, `idle_timeout (Ns)`,
   * `oom_killed` (reached its memory limit), `memory_reclaimed` (used more
   * than its memory request while the node was short), `exited with code N`, `failed: <stage> <detail>`,
   * `lost: runtime restarted`, `lost: host restarted`, `token_expiry`
   * (60 s before the token it was created with expired).
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
  /** Set when the node could not run or finish the command (not the command's own failure). */
  error?: string;
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
  /** The only hosts the egress proxy sends the value to; empty: nowhere. Absent from older gateways. */
  hosts?: string[];
  /** Set on an agent's secret, which only that agent's runs (sandboxes labelled `cere.agent=<agent>`) use. */
  agent?: string;
  created_at: string;
  updated_at: string;
}

/**
 * `PUT /v1/secrets/{name}` body. Write-only: the value is never returned or logged. `hosts` binds the value to the
 * hosts it may be sent to (exact names, or `*.example.com` for one more label); a sandbox whose rule names the secret
 * for another host is refused at create (400 `credential_not_bound`). Storing again replaces value and hosts.
 */
export interface SecretInput {
  type: 'header';
  header: string;
  value: string;
  hosts: string[];
}

/** A host a secret may be bound to: a lower-case DNS name, optionally `*.` and at least two labels. */
export const SECRET_HOST_RE = /^(\*\.)?[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** Splits what a person typed into hosts: commas or spaces, lower-cased, without repeats. */
export function parseHosts(input: string): string[] {
  const out: string[] = [];
  for (const h of input.split(/[\s,]+/)) {
    const v = h.trim().toLowerCase().replace(/\.$/, '');
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

/** `^[a-z0-9][a-z0-9-]{0,62}$` */
export const SECRET_NAME_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** `policy`: a change to a running sandbox's rules (one entry per rule added or removed), not a request. */
export type EgressDecision = 'allowed' | 'denied' | 'error' | 'policy';

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
 * carries (the billed amounts × 1e11), as decimal strings because they exceed
 * JavaScript's safe integer range. `cpu_s`/`ram_gib_s` are as measured.
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
  /** Why the DAC agent refused the record, when it did. */
  dac_error?: string | null;
  dac_updated_at: string | null;
  /** The basis this record billed on. The billing fields are absent from gateways that predate them. */
  billing_basis?: BillingBasis;
  /** Seconds the sandbox ran in this period. */
  wall_s?: number;
  /** The sandbox's request ("reserved"): vCPU and MiB. */
  reserved_cpu?: number;
  reserved_memory_mib?: number;
  /** The request × `wall_s`: the guaranteed floor. */
  reserved_cpu_s?: number;
  reserved_ram_gib_s?: number;
  /** What the record bills: `cpu_units`/`ram_units` / 1e11. */
  billed_cpu_s?: number;
  billed_ram_gib_s?: number;
  /** The sandbox's limits: vCPU and MiB. Absent before limits (then the request was the limit). */
  cpu_limit?: number;
  /** The memory limit under its name before 26 Nov; the client fills it from `memory_limit` when only that is sent. */
  memory_limit_mib?: number;
  memory_limit?: number;
  /** Billed above the request. Absent before limits: then `max(0, billed − reserved)`. */
  burst_cpu_s?: number;
  burst_ram_gib_s?: number;
  /** The highest per-second CPU use in the period, in cores. */
  cpu_peak?: number;
}

/** The exit reason of a sandbox the node ended 60 s before the token it was created with expired. */
export const EXIT_TOKEN_EXPIRY = 'token_expiry';
/** The sandbox reached its own memory limit (`memory_limit_mib`). */
export const EXIT_OOM_KILLED = 'oom_killed';
/** The sandbox used more than its memory request while its node was short of memory, and was stopped to free it. */
export const EXIT_MEMORY_RECLAIMED = 'memory_reclaimed';

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

/**
 * An ending that is a failure: it never started (`failed`), the node stopped it
 * for memory (`oom_killed`, `memory_reclaimed`), it was lost with its node or runtime (`lost: …`),
 * or its main process exited with a non-zero code. A timeout or idle timeout is
 * the limit you set, and a terminate is yours: those are Finished.
 */
export function endedBadly(s: Pick<Sandbox, 'status' | 'exit_reason'>): boolean {
  if (s.status === 'failed') return true;
  if (s.status !== 'terminated' || !s.exit_reason) return false;
  const r = s.exit_reason;
  if (r.startsWith(EXIT_OOM_KILLED) || r.startsWith(EXIT_MEMORY_RECLAIMED)) return true;
  if (r.startsWith('lost') || r.startsWith('failed')) return true;
  const code = /^exited with code (-?\d+)/.exec(r);
  return !!code && code[1] !== '0';
}
