/**
 * What a sandbox is billed, next to what its node measured, worded as the cere
 * CLI prints it (ddc-node `packages/cli/output.go` `billingLine`, and
 * `packages/cli/records.go` for `cere usage`), so a sandbox reads the same here
 * and in a terminal.
 *
 * A sandbox is billed its request (the CPU and memory guaranteed to it) for as
 * long as it runs, the floor, plus what it used above the request, the burst:
 * each second the larger of the request and the use (`request_or_usage`).
 * Records from before limits say `reserved` (the same, per minute) and carry
 * no burst field: their burst is what was billed above the floor. On the
 * `measured` basis a sandbox is billed what was measured. Every number here is
 * one the gateway sent; a gateway that predates the billing fields sends none,
 * and then there is nothing extra to say (records then bill their units, as
 * measured).
 */
import { fmtQty, fmtQtyAt, qtyDecimals } from './format';
import type { DacStatus, Usage, UsageRecord } from './types';

/**
 * `v` with `digits` decimals, as Go's `%.<digits>f` prints it: a value exactly
 * halfway (0.25 to one decimal) rounds to the even digit ("0.2"), where
 * JavaScript's `toFixed` rounds it up ("0.3").
 */
export function fmtFixed(v: number, digits: number): string {
  if (!Number.isFinite(v)) return v.toFixed(digits);
  const abs = Math.abs(v);
  // Halfway at `digits` decimals, exactly, only for odd multiples of 2^-(digits+1).
  const halves = abs * 2 ** (digits + 1);
  if (!Number.isInteger(halves) || halves % 2 !== 1) return v.toFixed(digits);
  const lo = Math.floor(abs * 10 ** digits);
  const even = String(lo % 2 === 0 ? lo : lo + 1).padStart(digits + 1, '0');
  const s = digits > 0 ? `${even.slice(0, -digits)}.${even.slice(-digits)}` : even;
  return v < 0 ? `-${s}` : s;
}

const f1 = (v: number) => fmtFixed(v, 1);

/** A reservation with the decimals it has: 1 → "1.0", 0.25 → "0.25" (to a thousandth). */
export function cores(v: number): string {
  // Go's math.Round: halves away from zero.
  const r = (Math.sign(v) * Math.round(Math.abs(v) * 1000)) / 1000;
  const s = String(r);
  return s.includes('.') ? s : `${s}.0`;
}

/**
 * A billed amount in parts: the guaranteed floor (the request × the time it
 * ran), the burst (billed above the request), and what was billed as measured
 * (the `measured` basis, or a record from before the billing fields). The
 * parts add up to `billed`.
 */
export interface BilledParts {
  floor: number;
  burst: number;
  asMeasured: number;
  billed: number;
}

export const NO_PARTS: BilledParts = { floor: 0, burst: 0, asMeasured: 0, billed: 0 };

/**
 * Split one billed amount. `reserved` is the floor (`reserved_cpu_s`), `burst`
 * the record's burst field; without it (records from before limits) the
 * burst is what was billed above the floor, `max(0, billed − reserved)`. The
 * floor is what is left of the bill, so a run billed less than its floor (its
 * node changed basis while it ran) shows what it was billed.
 */
export function billedParts(
  basis: string | undefined,
  reserved: number | undefined,
  billed: number,
  burst?: number,
): BilledParts {
  if (!basis || basis === 'measured') return { floor: 0, burst: 0, asMeasured: billed, billed };
  const b = Math.min(billed, Math.max(0, burst ?? billed - (reserved ?? 0)));
  return { floor: billed - b, burst: b, asMeasured: 0, billed };
}

/**
 * Memory is billed on its working set (what it uses, less file cache the
 * kernel can drop), while the measured GiB-seconds and peak are all of it,
 * cache included: so memory billed can be below what was measured. Never
 * read that gap as burst. True when what was measured is above the bill by
 * more than rounding.
 */
export const measuredIncludesCache = (measured: number, billed: number): boolean => measured > billed + 0.05;

/** The caption for that gap, or ''. */
export const CACHE_NOTE = 'file cache is measured, not billed';

export const addParts = (a: BilledParts, b: BilledParts): BilledParts => ({
  floor: a.floor + b.floor,
  burst: a.burst + b.burst,
  asMeasured: a.asMeasured + b.asMeasured,
  billed: a.billed + b.billed,
});

/**
 * The parts in words, for a caption under a total: "15.0 request + 3.2
 * burst", "15.0 request, no burst", "9.40 as measured".
 */
export function partsLine(p: BilledParts, fmt: (v: number) => string = f1): string {
  const parts: string[] = [];
  if (p.floor > 0 || p.burst > 0) parts.push(`${fmt(p.floor)} request`);
  if (p.burst > 0) parts.push(`${fmt(p.burst)} burst`);
  if (p.asMeasured > 0) parts.push(`${fmt(p.asMeasured)} as measured`);
  if (!parts.length) return '';
  if (p.burst === 0 && p.asMeasured === 0) return `${parts[0]}, no burst`;
  return parts.join(' + ');
}

/**
 * A bill's parts as they show next to its total (`fmtQty(billed)`), so they add up to the total as shown: each at the
 * total's precision, the burst being the shown total less the shown request (as the CLI does). "74.4 CPU-s" then reads
 * "19.8 request + 54.6 burst", not "+ 54.7".
 */
export function shownParts(p: BilledParts): { parts: BilledParts; fmt: (v: number) => string } {
  const d = qtyDecimals(p.billed);
  const r = (v: number) => Math.round(v * 10 ** d) / 10 ** d;
  const billed = r(p.billed);
  const floor = r(p.floor);
  const asMeasured = r(p.asMeasured);
  const burst = p.burst > 0 ? Math.max(0, r(billed - floor - asMeasured)) : 0;
  return { parts: { floor, burst, asMeasured, billed }, fmt: (v) => fmtQtyAt(v, d) };
}

/** `partsLine` at the precision of the total shown above it. */
export function shownPartsLine(p: BilledParts): string {
  const s = shownParts(p);
  return partsLine(s.parts, s.fmt);
}

/**
 * One billed amount: the request over the wall time with what was measured,
 * plus the burst above it, or, under the measured basis, what was measured.
 * `burst` is the usage's burst field (absent before limits).
 */
export function billedPart(
  basis: string,
  reservation: string,
  unit: string,
  wall: number,
  reserved: number,
  billed: number,
  measured: number,
  burst?: number,
  /** Say that file cache explains measured above billed (memory). */
  cache = false,
): string {
  const over = `${reservation} × ${f1(wall)} s = ${f1(reserved)}`;
  if (basis === 'measured') return `${f1(billed)} ${unit} as measured (reserved ${over})`;
  if (basis === 'request_or_usage') {
    const p = billedParts(basis, reserved, billed, burst);
    const about = `measured ${f1(measured)}${cache && measuredIncludesCache(measured, billed) ? `; ${CACHE_NOTE}` : ''}`;
    if (p.burst < 0.05) return `${over} ${unit} request, no burst (${about})`;
    return `${over} ${unit} request + ${f1(p.burst)} ${unit} burst = ${f1(billed)} ${unit} (${about})`;
  }
  // A run billed less than its reservation had part of it billed as measured (its node changed basis while it ran).
  if (billed < reserved - 0.05)
    return `${f1(billed)} ${unit}, part of the run as measured (measured ${f1(measured)}; reserved ${over})`;
  if (billed > reserved + 0.05)
    return `${f1(billed)} ${unit}, the larger of reserved and measured per minute (measured ${f1(measured)}; reserved ${over})`;
  return `${over} ${unit} (measured ${f1(measured)})`;
}

/**
 * `billedPart` without the reservation arithmetic, for a table cell (the full
 * text goes in its tooltip): "54.0 CPU-s (measured 9.4)",
 * "60.2 CPU-s (measured 60.2)", "9.4 CPU-s as measured".
 */
export function billedPartShort(
  basis: string,
  unit: string,
  reserved: number,
  billed: number,
  measured: number,
  burst?: number,
) {
  if (basis === 'measured') return `${f1(billed)} ${unit} as measured`;
  if (basis === 'request_or_usage') {
    const p = billedParts(basis, reserved, billed, burst);
    if (p.burst < 0.05) return `${f1(billed)} ${unit} (measured ${f1(measured)})`;
    return `${f1(billed)} ${unit}, ${f1(p.burst)} burst (measured ${f1(measured)})`;
  }
  if (billed < reserved - 0.05) return `${f1(billed)} ${unit}, part as measured`;
  if (billed > reserved + 0.05) return `${f1(billed)} ${unit} (measured ${f1(measured)})`;
  return `${f1(reserved)} ${unit} (measured ${f1(measured)})`;
}

/** The usage's billing basis; '' when the node has not reported yet or the gateway predates billing. */
export const basisOf = (u: Pick<Usage, 'billing_basis'>): string => u.billing_basis ?? '';

/** The usage's billing fields, 0 where an older gateway sent none. */
function amounts(u: Usage) {
  return {
    wall: u.wall_s ?? 0,
    cpu: {
      reserved: u.reserved_cpu_s ?? 0,
      billed: u.billed_cpu_s ?? 0,
      measured: u.cpu_s ?? 0,
      burst: u.burst_cpu_s,
    },
    ram: {
      reserved: u.reserved_ram_gib_s ?? 0,
      billed: u.billed_ram_gib_s ?? 0,
      measured: u.ram_gib_s ?? 0,
      burst: u.burst_ram_gib_s,
    },
  };
}

/** A sandbox's usage in parts (floor, burst, as measured), CPU-s and GiB-s; null before the node reports billing. */
export function usageParts(u: Usage): { cpu: BilledParts; ram: BilledParts } | null {
  const basis = basisOf(u);
  if (basis === '') return null;
  const { cpu, ram } = amounts(u);
  return {
    cpu: billedParts(basis, cpu.reserved, cpu.billed, cpu.burst),
    ram: billedParts(basis, ram.reserved, ram.billed, ram.burst),
  };
}

/**
 * The CPU half of `billingLine`. `cpu` is the reservation in vCPU (0 when not
 * known: then taken from the usage).
 */
export function billedCPU(u: Usage, cpu: number): string {
  const basis = basisOf(u);
  if (basis === '') return '';
  const { wall, cpu: a } = amounts(u);
  if (!(cpu > 0) && wall > 0) cpu = a.reserved / wall;
  return billedPart(basis, `${cores(cpu || 0)} vCPU`, 'CPU-s', wall, a.reserved, a.billed, a.measured, a.burst);
}

/** The memory half of `billingLine`. `memoryMiB` is the reservation (0 when not known: then taken from the usage). */
export function billedMemory(u: Usage, memoryMiB: number): string {
  const basis = basisOf(u);
  if (basis === '') return '';
  const { wall, ram: a } = amounts(u);
  let gib = (memoryMiB || 0) / 1024;
  if (!(gib > 0) && wall > 0) gib = a.reserved / wall;
  return billedPart(basis, `${cores(gib)} GiB`, 'GiB-s', wall, a.reserved, a.billed, a.measured, a.burst, true);
}

/**
 * The billed amounts in short, for table cells: `cpu` "54.0 CPU-s (measured
 * 9.4)", `memory` "54.0 GiB-s (measured 15.0)". Null when the gateway sent no
 * billing fields.
 */
export function billedShort(u: Usage): { cpu: string; memory: string } | null {
  const basis = basisOf(u);
  if (basis === '') return null;
  const { cpu, ram } = amounts(u);
  return {
    cpu: billedPartShort(basis, 'CPU-s', cpu.reserved, cpu.billed, cpu.measured, cpu.burst),
    memory: billedPartShort(basis, 'GiB-s', ram.reserved, ram.billed, ram.measured, ram.burst),
  };
}

/**
 * What a sandbox is billed and what it measured, for CPU and memory:
 * "1.0 vCPU × 54.0 s = 54.0 CPU-s (measured 9.4), 1.0 GiB × 54.0 s = 54.0 GiB-s
 * (measured 15.0)". `cpu` and `memoryMiB` are its reservation
 * (`resources.cpu`, `resources.memory_mib`). Empty when the gateway sent no
 * billing fields.
 */
export function billingLine(u: Usage, cpu: number, memoryMiB: number): string {
  const c = billedCPU(u, cpu);
  if (c === '') return '';
  return `${c}, ${billedMemory(u, memoryMiB)}`;
}

/** A DAC unit string / 1e11; 0 when it is not an unsigned 64-bit integer. */
export function unitsToFloat(s: string | null | undefined): number {
  if (!s || !/^\d+$/.test(s) || BigInt(s) > 0xffff_ffff_ffff_ffffn) return 0;
  return Number(s) / 1e11;
}

export type RecordBillingFields = Pick<
  UsageRecord,
  | 'cpu_units'
  | 'ram_units'
  | 'billing_basis'
  | 'reserved_cpu'
  | 'reserved_memory_mib'
  | 'billed_cpu_s'
  | 'billed_ram_gib_s'
> &
  Partial<
    Pick<
      UsageRecord,
      | 'reserved_cpu_s'
      | 'reserved_ram_gib_s'
      | 'burst_cpu_s'
      | 'burst_ram_gib_s'
      | 'cpu_limit'
      | 'memory_limit_mib'
      | 'cpu_peak'
    >
  >;

/**
 * A record's basis, reservation ("1.0 vCPU, 1.0 GiB") and billed amounts. A
 * record from a gateway that predates the billing fields billed its units /
 * 1e11, and has no basis or reservation to show ("—").
 */
export function recordBilling(r: RecordBillingFields): { basis: string; reserved: string; cpu: number; ram: number } {
  if (!r.billing_basis) {
    return { basis: '—', reserved: '—', cpu: unitsToFloat(r.cpu_units), ram: unitsToFloat(r.ram_units) };
  }
  return {
    basis: r.billing_basis,
    reserved: `${cores(r.reserved_cpu ?? 0)} vCPU, ${cores((r.reserved_memory_mib ?? 0) / 1024)} GiB`,
    cpu: r.billed_cpu_s ?? 0,
    ram: r.billed_ram_gib_s ?? 0,
  };
}

/** A record's billed CPU-s and GiB-s in parts (floor, burst, as measured). */
export function recordParts(r: RecordBillingFields): { cpu: BilledParts; ram: BilledParts } {
  const b = recordBilling(r);
  const basis = r.billing_basis || undefined;
  return {
    cpu: billedParts(basis, r.reserved_cpu_s, b.cpu, r.burst_cpu_s),
    ram: billedParts(basis, r.reserved_ram_gib_s, b.ram, r.burst_ram_gib_s),
  };
}

/**
 * A sandbox's records summed, in words: "billed 98.3 CPU-s (22.7 request + 75.6 burst) and 25.5 GiB-s (11.4 request
 * + 14.1 burst); measured 86.7 CPU-s and 20.0 GiB-s". Without a burst, or on an older basis, the billed amount alone.
 */
export function recordSumsLine(t: {
  billed_cpu_s: number;
  billed_ram_gib_s: number;
  cpu_s: number;
  ram_gib_s: number;
  burst_cpu_s?: number;
  burst_ram_gib_s?: number;
}) {
  const one = (billed: number, burst: number | undefined, unit: string) => {
    const p = shownParts({ floor: billed - (burst ?? 0), burst: burst ?? 0, asMeasured: 0, billed });
    return p.parts.burst > 0
      ? `${p.fmt(p.parts.billed)} ${unit} (${p.fmt(p.parts.floor)} request + ${p.fmt(p.parts.burst)} burst)`
      : `${p.fmt(p.parts.billed)} ${unit}`;
  };
  return (
    `billed ${one(t.billed_cpu_s, t.burst_cpu_s, 'CPU-s')} and ${one(t.billed_ram_gib_s, t.burst_ram_gib_s, 'GiB-s')}` +
    `; measured ${fmtQty(t.cpu_s)} CPU-s and ${fmtQty(t.ram_gib_s)} GiB-s`
  );
}

/**
 * Whether a set of usage records has been counted for billing, as one state:
 * `failed` when any was refused, else `pending` when any is still waiting,
 * else `pushed`; null for none.
 */
export function countingState(rs: Pick<UsageRecord, 'dac_status'>[]): DacStatus | null {
  if (!rs.length) return null;
  if (rs.some((r) => r.dac_status === 'failed')) return 'failed';
  if (rs.some((r) => r.dac_status !== 'pushed')) return 'pending';
  return 'pushed';
}
