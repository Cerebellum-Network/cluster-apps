/**
 * What a sandbox is billed, next to what its node measured, worded as the cere
 * CLI prints it (ddc-node `packages/cli/output.go` `billingLine`, and
 * `packages/cli/records.go` for `cere usage`, as of b2b367cc1), so a sandbox reads
 * the same here and in a terminal.
 *
 * On the `reserved` basis a sandbox is billed for what it reserves for as long
 * as it runs: vCPU × wall seconds and GiB × wall seconds, or the measured
 * CPU-seconds and GiB-seconds where those are more. On the `measured` basis it
 * is billed what was measured. Every number here is one the gateway sent; a
 * gateway that predates the billing fields sends none, and then there is
 * nothing extra to say (records then bill their DAC units).
 */
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
 * One billed amount: the reservation over the wall time with what was
 * measured, the measured amount where it is more than the reservation, or,
 * under the measured basis, what was measured.
 */
export function billedPart(
  basis: string,
  reservation: string,
  unit: string,
  wall: number,
  reserved: number,
  billed: number,
  measured: number,
): string {
  const over = `${reservation} × ${f1(wall)} s = ${f1(reserved)}`;
  if (basis === 'measured') return `${f1(billed)} ${unit} as measured (reserved ${over})`;
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
export function billedPartShort(basis: string, unit: string, reserved: number, billed: number, measured: number) {
  if (basis === 'measured') return `${f1(billed)} ${unit} as measured`;
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
    cpu: { reserved: u.reserved_cpu_s ?? 0, billed: u.billed_cpu_s ?? 0, measured: u.cpu_s ?? 0 },
    ram: { reserved: u.reserved_ram_gib_s ?? 0, billed: u.billed_ram_gib_s ?? 0, measured: u.ram_gib_s ?? 0 },
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
  return billedPart(basis, `${cores(cpu || 0)} vCPU`, 'CPU-s', wall, a.reserved, a.billed, a.measured);
}

/** The memory half of `billingLine`. `memoryMiB` is the reservation (0 when not known: then taken from the usage). */
export function billedMemory(u: Usage, memoryMiB: number): string {
  const basis = basisOf(u);
  if (basis === '') return '';
  const { wall, ram: a } = amounts(u);
  let gib = (memoryMiB || 0) / 1024;
  if (!(gib > 0) && wall > 0) gib = a.reserved / wall;
  return billedPart(basis, `${cores(gib)} GiB`, 'GiB-s', wall, a.reserved, a.billed, a.measured);
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
    cpu: billedPartShort(basis, 'CPU-s', cpu.reserved, cpu.billed, cpu.measured),
    memory: billedPartShort(basis, 'GiB-s', ram.reserved, ram.billed, ram.measured),
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

/** `cere usage`'s sums: "billed 54.000 CPU-s, 54.000 GiB-s (measured 9.400 CPU-s, 15.000 GiB-s)". */
export function recordSumsLine(t: {
  billed_cpu_s: number;
  billed_ram_gib_s: number;
  cpu_s: number;
  ram_gib_s: number;
}) {
  const f3 = (v: number) => fmtFixed(v, 3);
  return `billed ${f3(t.billed_cpu_s)} CPU-s, ${f3(t.billed_ram_gib_s)} GiB-s (measured ${f3(t.cpu_s)} CPU-s, ${f3(t.ram_gib_s)} GiB-s)`;
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
