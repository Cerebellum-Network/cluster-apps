/** Formatting shared by every screen: one way to show a key, a size or a time. */

/** A 64-hex key as `abcdef…1234`. Shorter strings are returned whole. */
export function shortKey(k: string | null | undefined, head = 6, tail = 4): string {
  if (!k) return '—';
  const s = k.replace(/^0x/, '');
  return s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`;
}

const nf = (max = 1) => new Intl.NumberFormat('en-US', { maximumFractionDigits: max });

export function num(n: number | null | undefined, max = 1): string {
  return n === null || n === undefined || Number.isNaN(n) ? '—' : nf(max).format(n);
}

/** MiB as GiB when ≥ 1 GiB. */
export function mib(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n >= 1024 ? `${nf(1).format(n / 1024)} GiB` : `${nf(0).format(n)} MiB`;
}

export function bytes(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n;
  let i = 0;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return `${nf(i === 0 ? 0 : 1).format(v)} ${units[i]}`;
}

export function cpu(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : `${nf(2).format(n)} CPU`;
}

/** Seconds as `1h 2m`, `3m 4s`, `5.2s`. */
export function seconds(s: number | null | undefined): string {
  if (s === null || s === undefined) return '—';
  if (s < 60) return `${nf(1).format(s)}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${Math.round(s % 60)}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** An RFC 3339 time as `Nov 25, 10:01:02` in the viewer's zone. */
export function time(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/** How long ago, for "last report 12 s ago". */
export function ago(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

/** Group items by a key, keeping first-seen order of the groups. */
export function groupBy<T>(items: T[], key: (t: T) => string): [string, T[]][] {
  const out = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const list = out.get(k);
    if (list) list.push(it);
    else out.set(k, [it]);
  }
  return [...out.entries()];
}

/** The node a placement chose: the accepted attempt, else the sandbox's node. */
export function chosenNode(
  p: { attempts?: { node: string; result: string }[] } | null | undefined,
  fallback: string | null,
): string | null {
  const ok = p?.attempts?.find((a) => a.result === 'accepted');
  return ok?.node ?? fallback;
}
