import type { LiveSandbox, SandboxResources, Usage, UsageAmounts } from '~/api/types';

/**
 * Requests, limits and burst, as the console shows them.
 *
 * A sandbox's request (`cpu`, `memory_mib`) is what the node's sandbox quota
 * counts and what it pays for at least; its limit is the most it can use. Use
 * above the request is burst, billed as used. A backend, a resource manager
 * or a node from before limits reports none: such a sandbox is limited at its
 * request.
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
    memoryMiB: r.memory_mib,
    cpuLimit: limitOr(r.cpu_limit, r.cpu),
    memoryLimitMiB: limitOr(r.memory_limit_mib, r.memory_mib),
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
  const used = s.live ? (r === 'cpu' ? s.live.cpu : s.live.memory_mib) : null;
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

/** Why a sandbox ended, in plain words. The runtime's reason stays behind a tooltip. */
export function exitReasonWords(reason: string | null | undefined): string | null {
  if (!reason) return null;
  const r = reason.trim();
  if (r === 'oom_killed') return 'Out of memory: it reached its memory limit';
  if (r === 'memory_reclaimed')
    return 'Memory reclaimed: it was using more than its memory request while the node was short of memory';
  if (r === 'terminated by API') return 'Terminated through the API';
  if (r === 'token_expiry') return 'Its access token was about to expire';
  if (r === 'lost: runtime restarted') return 'Lost: the node’s sandbox runtime restarted';
  if (r === 'lost: host restarted') return 'Lost: the node restarted';
  let m = /^timeout \((\d+)s\)$/.exec(r);
  if (m) return `Reached its time limit (${m[1]} s)`;
  m = /^idle_timeout \((\d+)s\)$/.exec(r);
  if (m) return `Idle for ${m[1]} s`;
  m = /^exited with code (-?\d+)$/.exec(r);
  if (m) return m[1] === '0' ? 'Finished' : `Exited with code ${m[1]}`;
  m = /^disk_limit \((\d+) MiB\)$/.exec(r);
  if (m) return `Reached its disk limit (${m[1]} MiB)`;
  if (r === 'disk_limit (node disk is low)') return 'Stopped: the node was short of disk';
  m = /^failed: image pull (.+)$/.exec(r);
  if (m) return `Couldn’t pull its image: ${m[1]}`;
  m = /^failed: (create|start) ?(.*)$/.exec(r);
  if (m) return `Couldn’t ${m[1]}${m[2] ? `: ${m[2]}` : ''}`;
  return r;
}
