/** Formatters for the Sandboxes and Agents pages. Units are the API's own; no prices. */

export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${String(m % 60).padStart(2, '0')}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

/** "12s ago", "4m 03s ago", from an RFC 3339 time. */
export function fmtAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const s = (now - Date.parse(iso)) / 1000;
  if (s < 5) return 'just now';
  if (s >= 2 * 86400) return `${Math.floor(s / 86400)} days ago`;
  return `${fmtDuration(s)} ago`;
}

export function fmtClock(iso: string | number): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function fmtDateTime(iso: string | number): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
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
  if (Math.abs(v) < 10) return v.toFixed(2);
  if (Math.abs(v) < 100) return v.toFixed(1);
  return Math.round(v).toLocaleString('en-US');
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

/** Sum CPU-seconds and GiB-seconds over usage records (the billed quantities). */
export function sumRecords(
  rs: { cpu_s: number; ram_gib_s: number; net_egress_bytes: number; net_ingress_bytes: number }[],
) {
  return rs.reduce(
    (a, r) => ({
      cpu_s: a.cpu_s + r.cpu_s,
      ram_gib_s: a.ram_gib_s + r.ram_gib_s,
      net_egress_bytes: a.net_egress_bytes + r.net_egress_bytes,
      net_ingress_bytes: a.net_ingress_bytes + r.net_ingress_bytes,
    }),
    { cpu_s: 0, ram_gib_s: 0, net_egress_bytes: 0, net_ingress_bytes: 0 },
  );
}

/** Add decimal-string integers exactly (DAC cpu_units / ram_units). */
export function sumUnits(values: string[]): string {
  let total = 0n;
  for (const v of values) if (/^\d+$/.test(v)) total += BigInt(v);
  return total.toString();
}
