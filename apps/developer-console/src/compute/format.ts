/** Formatters for the Sandboxes and Agents pages. Units are the API's own; no prices. */

import { addParts, NO_PARTS, recordParts, type BilledParts, type RecordBillingFields } from './billing';
import type { UsageRecord } from './types';

/** "1 file", "2 files". */
export function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${String(m % 60).padStart(2, '0')}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

/** A time limit in words (`timeout_s`, `idle_timeout_s`): "45 s", "5 min", "1.5 h"; 0 is none. */
export function fmtLimit(seconds: number): string {
  if (seconds >= 3600) return `${+(seconds / 3600).toFixed(1)} h`;
  if (seconds >= 60) return `${+(seconds / 60).toFixed(1)} min`;
  return `${seconds} s`;
}

/** "12s ago", "4m 03s ago", from an RFC 3339 time. */
export function fmtAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const s = (now - Date.parse(iso)) / 1000;
  if (s < 5) return 'just now';
  if (s >= 2 * 86400) return `${Math.floor(s / 86400)} days ago`;
  return `${fmtDuration(s)} ago`;
}

/**
 * Times on these pages are the browser's local time, and say which zone that
 * is ("GMT+3", "UTC"): the API and the CLI print UTC (RFC 3339), so a time
 * without its zone reads as hours off from the CLI's.
 */
export function localZone(at: string | number | Date = Date.now()): string {
  const part = new Intl.DateTimeFormat('en-GB', { timeZoneName: 'short' })
    .formatToParts(new Date(at))
    .find((p) => p.type === 'timeZoneName');
  return part?.value ?? 'local time';
}

/** "04:02:08", local time; pair it with `localZone()` in a column header. */
export function fmtClock(iso: string | number): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** "25 Nov, 04:02:08 GMT+3": local time with its zone. */
export function fmtDateTime(iso: string | number): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}

/** The RFC 3339 UTC form the API and the CLI print, for a tooltip. */
export function fmtUtc(iso: string | number): string {
  return new Date(iso).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

export function fmtMib(mib: number): string {
  return mib >= 1024 ? `${+(mib / 1024).toFixed(mib % 1024 === 0 ? 0 : 1)} GiB` : `${Math.round(mib)} MiB`;
}

export function fmtCpu(cpu: number): string {
  return `${+cpu.toFixed(2)} vCPU`;
}

/** Quantities like CPU-seconds: 2 decimals under 10, 1 under 100, then whole numbers with separators. */
export function fmtQty(v: number): string {
  if (!Number.isFinite(v) || v === 0) return '0';
  return fmtQtyAt(v, qtyDecimals(v));
}

/** The decimals `fmtQty` shows for `v`: 2 below 10, 1 below 100, none above. */
export const qtyDecimals = (v: number): number => (Math.abs(v) < 10 ? 2 : Math.abs(v) < 100 ? 1 : 0);

/** `v` with `d` decimals, whole numbers with thousands separators (as `fmtQty` writes them). */
export function fmtQtyAt(v: number, d: number): string {
  if (!Number.isFinite(v)) return String(v);
  if (v === 0) return '0';
  return d > 0 ? v.toFixed(d) : Math.round(v).toLocaleString('en-US');
}

/** A decimal-string integer (DAC units exceed 2^53) with thousands separators, exact. */
export function fmtUnits(units: string): string {
  return /^\d+$/.test(units) ? units.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : units;
}

/** sb-01jdx3q4… → `sb-01jdx…7kq1` for dense tables. */
export function shortId(id: string): string {
  return id.length > 16 ? `${id.slice(0, 10)}…${id.slice(-4)}` : id;
}

/** A node's 64-hex id → `3fa2c1d0…9b41`. */
export function shortNode(node: string | null | undefined): string {
  if (!node) return '—';
  return node.length > 16 ? `${node.slice(0, 8)}…${node.slice(-4)}` : node;
}

/** `cerebellumnetwork/ddc-agent-runner:0.1.0` → `ddc-agent-runner:0.1.0`. */
export function shortImage(image: string): string {
  return image.split('/').pop() ?? image;
}

/**
 * Sum usage records: billed CPU-seconds and GiB-seconds, in parts (the
 * guaranteed floor, the burst above it, what was billed as measured), the
 * reserved amounts, and what was measured.
 */
export function sumRecords(
  rs: (Pick<UsageRecord, 'cpu_s' | 'ram_gib_s' | 'net_egress_bytes' | 'net_ingress_bytes'> & RecordBillingFields)[],
) {
  const zero = {
    cpu_s: 0,
    ram_gib_s: 0,
    billed_cpu_s: 0,
    billed_ram_gib_s: 0,
    burst_cpu_s: 0,
    burst_ram_gib_s: 0,
    reserved_cpu_s: 0,
    reserved_ram_gib_s: 0,
    net_egress_bytes: 0,
    net_ingress_bytes: 0,
    cpu: NO_PARTS as BilledParts,
    ram: NO_PARTS as BilledParts,
  };
  return rs.reduce((a, r) => {
    const p = recordParts(r);
    const cpu = addParts(a.cpu, p.cpu);
    const ram = addParts(a.ram, p.ram);
    return {
      cpu_s: a.cpu_s + r.cpu_s,
      ram_gib_s: a.ram_gib_s + r.ram_gib_s,
      billed_cpu_s: cpu.billed,
      billed_ram_gib_s: ram.billed,
      burst_cpu_s: cpu.burst,
      burst_ram_gib_s: ram.burst,
      reserved_cpu_s: a.reserved_cpu_s + r.reserved_cpu_s,
      reserved_ram_gib_s: a.reserved_ram_gib_s + r.reserved_ram_gib_s,
      net_egress_bytes: a.net_egress_bytes + r.net_egress_bytes,
      net_ingress_bytes: a.net_ingress_bytes + r.net_ingress_bytes,
      cpu,
      ram,
    };
  }, zero);
}

/** Add decimal-string integers exactly (DAC cpu_units / ram_units). */
export function sumUnits(values: string[]): string {
  let total = 0n;
  for (const v of values) if (/^\d+$/.test(v)) total += BigInt(v);
  return total.toString();
}
