import type { ExitKind, LiveSandbox, SandboxResources, Usage, UsageAmounts } from '~/api/types';

/**
 * Requests, limits and burst, as the console shows them.
 *
 * A sandbox's request (`cpu`, `memory`) is what the node's sandbox quota
 * counts and what it pays for at least; its limit is the most it can use. Use
 * above the request is burst, billed as used. A sandbox with no limit (a
 * stored row from before limits) is limited at its request.
 */

export interface Limits {
  cpu: number;
  memoryMiB: number;
  cpuLimit: number;
  memoryLimitMiB: number;
}

const limitOr = (limit: number | null | undefined, request: number) =>
  limit != null && limit > 0 ? Math.max(limit, request) : request;

export function limitsOf(r: SandboxResources): Limits {
  return {
    cpu: r.cpu,
    memoryMiB: r.memory,
    cpuLimit: limitOr(r.cpu_limit, r.cpu),
    memoryLimitMiB: limitOr(r.memory_limit, r.memory),
  };
}

export type Resource = 'cpu' | 'memory';

/** One resource of a sandbox now, in its unit (vCPU, or MiB). */
export interface ResourceUse {
  request: number;
  limit: number;
  /** null: no reading yet. */
  used: number | null;
  /** The part of use within the request. */
  within: number;
  /** Use above the request; 0 when the sandbox is limited at its request. */
  burst: number;
  /** Whether its limit lets it use more than its request. */
  canBurst: boolean;
}

/**
 * A sandbox limited at its request cannot burst: a reading a little above the
 * request is the metric's own jitter (a 1 vCPU sandbox read at 1.02), not
 * use that is billed.
 */
export function resourceUse(s: Pick<LiveSandbox, 'resources' | 'live'>, r: Resource): ResourceUse {
  const l = limitsOf(s.resources);
  const request = r === 'cpu' ? l.cpu : l.memoryMiB;
  const limit = r === 'cpu' ? l.cpuLimit : l.memoryLimitMiB;
  const used = s.live ? (r === 'cpu' ? s.live.cpu : s.live.memory) : null;
  const canBurst = limit > request;
  const within = used == null ? 0 : Math.min(used, request);
  const burst = used != null && canBurst ? Math.max(0, Math.min(used, limit) - request) : 0;
  return { request, limit, used, within, burst, canBurst };
}

/** One sandbox's place on a node lane: its request block, then its burst right after it. */
export interface LanePart {
  id: string;
  /** Where the block starts, in the lane's unit. */
  start: number;
  request: number;
  within: number;
  burst: number;
  used: number | null;
}

export interface Lane {
  parts: LanePart[];
  /** What the sandboxes request together: what the quota counts. */
  requested: number;
  /** What they use together, of those with a reading. */
  used: number;
  /** Their use above their requests, together. */
  burst: number;
  /** Where the last part ends: requests plus burst. */
  end: number;
}

/**
 * Lays the sandboxes of a node along one resource: each block sized by its
 * request and followed by its burst, so a sandbox using more than it requested
 * visibly runs past its block. The lane's length is the sum of each
 * sandbox's max(request, use): what is being billed now.
 */
export function laneOf(list: Pick<LiveSandbox, 'id' | 'resources' | 'live'>[], r: Resource, scale = 1): Lane {
  let at = 0;
  let requested = 0;
  let used = 0;
  let burst = 0;
  const parts = list.map((s) => {
    const u = resourceUse(s, r);
    const part: LanePart = {
      id: s.id,
      start: at,
      request: u.request / scale,
      within: u.within / scale,
      burst: u.burst / scale,
      used: u.used == null ? null : u.used / scale,
    };
    at += part.request + part.burst;
    requested += part.request;
    used += part.used ?? 0;
    burst += part.burst;
    return part;
  });
  return { parts, requested, used, burst, end: at };
}

/** Billed for one resource, split into the request (floor) and burst above it. */
export interface BilledSplit {
  billed: number;
  floor: number;
  burst: number;
}

const split = (
  basis: string | undefined,
  billed: number | undefined,
  reserved: number | undefined,
  burst: number | undefined,
): BilledSplit | null => {
  if (billed == null) return null;
  let b = burst ?? (basis === 'measured' || reserved == null ? 0 : billed - reserved);
  b = Math.min(Math.max(b, 0), Math.max(billed, 0));
  return { billed, floor: billed - b, burst: b };
};

/**
 * A sandbox's billed usage split into what its request cost and the burst
 * above it. Older usage carries no burst figure: it is billed above the
 * reserved floor, and 0 when billed on measured use, which has no floor.
 */
export function billedOf(u: Usage | null | undefined): { cpu: BilledSplit | null; memory: BilledSplit | null } {
  if (!u) return { cpu: null, memory: null };
  return {
    cpu: split(u.billing_basis, u.billed_cpu_s, u.reserved_cpu_s, u.burst_cpu_s),
    memory: split(u.billing_basis, u.billed_ram_gib_s, u.reserved_ram_gib_s, u.burst_ram_gib_s),
  };
}

/** Floor and burst of summed usage; a backend before limits sends neither: all of billed is then the floor. */
export function amountsSplit(a: UsageAmounts): { cpu: BilledSplit; memory: BilledSplit } {
  const cpuBurst = a.burst_cpu_s ?? 0;
  const ramBurst = a.burst_ram_gib_s ?? 0;
  return {
    cpu: { billed: a.billed_cpu_s, floor: a.floor_cpu_s ?? a.billed_cpu_s - cpuBurst, burst: cpuBurst },
    memory: { billed: a.billed_ram_gib_s, floor: a.floor_ram_gib_s ?? a.billed_ram_gib_s - ramBurst, burst: ramBurst },
  };
}

/**
 * Whether a billed burst amount (CPU- or GiB-seconds) is worth saying: it
 * shows as at least 0.1 in its unit. Less reads as "0 vCPU-s burst".
 */
export const sayBurst = (seconds: number | null | undefined): seconds is number => seconds != null && seconds >= 0.05;

/** How a sandbox's usage is billed, in words. */
export function billingBasisWords(basis: string | null | undefined): string | null {
  switch (basis) {
    case 'request_or_usage':
      return 'Billed every second for its request, or for its use when above it';
    case 'reserved':
      return 'Billed every minute for its request, or for its use when above it';
    case 'measured':
      return 'Billed for what it used';
    default:
      return null;
  }
}

/** How a sandbox ended, as the resource manager reports it. */
export interface Exit {
  exit_kind: ExitKind | null;
  exit_reason: string | null;
  exit_code?: number | null;
}

/**
 * Why a sandbox ended, in plain words, from the class of its ending
 * (`exit_kind`); the runtime's reason gives the detail (the time limit, the
 * disk, the stage that failed) and stays behind a tooltip. A kind this console
 * does not know shows the reason as it is.
 */
export function exitWords({ exit_kind: kind, exit_reason: reason, exit_code: code }: Exit): string | null {
  const r = reason?.trim() ?? '';
  let m: RegExpExecArray | null;
  switch (kind) {
    case 'main_exited': {
      const c = code ?? Number(/code (-?\d+)/.exec(r)?.[1] ?? NaN);
      if (Number.isNaN(c)) return 'Its command exited';
      return c === 0 ? 'Finished' : `Exited with code ${c}`;
    }
    case 'timeout':
      m = /\((\d+)s\)/.exec(r);
      return m ? `Reached its time limit (${m[1]} s)` : 'Reached its time limit';
    case 'idle_timeout':
      m = /\((\d+)s\)/.exec(r);
      return m ? `Idle for ${m[1]} s` : 'Idle for its idle limit';
    case 'oom':
      return 'Out of memory: it reached its memory limit';
    case 'memory_reclaimed':
      return 'Memory reclaimed: it was using more than its memory request while the node was short of memory';
    case 'disk_limit':
      if (/node disk is low/.test(r)) return 'Stopped: the node was short of disk';
      m = /\((\d+) MiB\)/.exec(r);
      return m ? `Reached its disk limit (${m[1]} MiB)` : 'Reached its disk limit';
    case 'insufficient_balance':
      return 'Stopped: the bucket’s owner ran out of balance';
    case 'terminated':
      m = /^terminated by API: (.+)$/.exec(r);
      return m ? `Terminated through the API: ${m[1]}` : 'Terminated through the API';
    case 'failed':
      m = /^failed: image pull ?(.*)$/.exec(r);
      if (m) return `Couldn’t pull its image${m[1] ? `: ${m[1]}` : ''}`;
      m = /^failed: (create|start) ?(.*)$/.exec(r);
      if (m) return `Couldn’t ${m[1]}${m[2] ? `: ${m[2]}` : ''}`;
      return r ? `Never ran: ${r.replace(/^failed: /, '')}` : 'Never ran';
    case 'lost':
      if (/runtime restarted/.test(r)) return 'Lost: the node’s sandbox runtime restarted';
      if (/host restarted/.test(r)) return 'Lost: the node restarted';
      return 'Lost with its node';
    default:
      return r || null;
  }
}
