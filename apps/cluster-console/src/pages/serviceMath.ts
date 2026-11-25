import type { DeliveryNode, DeliveryView, InferenceHistory, Machine, Point, StorageView } from '~/api/metricsTypes';
import type { ModelOnNode, ModelView, SourceError } from '~/api/types';

/**
 * The arithmetic behind the Storage, Delivery and Inference pages. Every
 * reading is nullable: a null is "no metric answered", never a zero, so sums
 * and ratios here skip nulls and return null when nothing is known.
 */

const DAY_MS = 86_400_000;

/** A share of disk at or above which a node counts as nearly full. */
export const NEARLY_FULL = 0.9;

const known = (v: number | null | undefined): v is number => v !== null && v !== undefined && !Number.isNaN(v);

/** The sum of the known values; null when none is known. */
export function sumKnown(values: readonly (number | null | undefined)[]): number | null {
  let sum = 0;
  let any = false;
  for (const v of values) {
    if (known(v)) {
      sum += v;
      any = true;
    }
  }
  return any ? sum : null;
}

/** part ÷ whole; null without both, or with a zero whole. */
export function ratio(part: number | null | undefined, whole: number | null | undefined): number | null {
  return known(part) && known(whole) && whole !== 0 ? part / whole : null;
}

/** The last known value of a series. */
export function lastKnown<T>(rows: readonly T[], pick: (r: T) => number | null | undefined): number | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const v = pick(rows[i]);
    if (known(v)) return v;
  }
  return null;
}

/** Last known value minus first known value; null with fewer than two readings. */
export function change<T>(rows: readonly T[], pick: (r: T) => number | null | undefined): number | null {
  const values = rows.map(pick).filter(known);
  return values.length >= 2 ? values[values.length - 1] - values[0] : null;
}

// Storage

export const isStorageMode = (mode: string) => mode === 'storage' || mode === 'full';

type Disk = Pick<Machine, 'disk_used_bytes' | 'disk_total_bytes'>;

export const diskShare = (m: Disk) => ratio(m.disk_used_bytes, m.disk_total_bytes);

/** Fullest first; nodes that don't report their disk last, by name. */
export function byFullest<T extends Disk & Pick<Machine, 'instance'>>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => {
    const sa = diskShare(a);
    const sb = diskShare(b);
    if (sa === null || sb === null) return sa === sb ? a.instance.localeCompare(b.instance) : sa === null ? 1 : -1;
    return sb - sa || a.instance.localeCompare(b.instance);
  });
}

export interface DiskTotals {
  /** Summed over the nodes that report both used and total, so the two compare. */
  used: number | null;
  total: number | null;
  reporting: number;
  nodes: number;
  nearlyFull: number;
  /** Nodes whose metrics say down (not those with no reading). */
  down: number;
}

export function diskTotals(machines: readonly (Disk & Pick<Machine, 'up'>)[]): DiskTotals {
  const reporting = machines.filter((m) => diskShare(m) !== null);
  return {
    used: sumKnown(reporting.map((m) => m.disk_used_bytes)),
    total: sumKnown(reporting.map((m) => m.disk_total_bytes)),
    reporting: reporting.length,
    nodes: machines.length,
    nearlyFull: reporting.filter((m) => (diskShare(m) ?? 0) >= NEARLY_FULL).length,
    down: machines.filter((m) => m.up === false).length,
  };
}

export type FullIn =
  | { kind: 'growing'; perDay: number; free: number; days: number }
  | { kind: 'flat' }
  | { kind: 'unknown'; why: string };

/**
 * When the storage nodes' disks fill if use keeps growing as it did between
 * the window's first and last readings: free disk ÷ growth a day.
 */
export function fullAtThisRate(series: StorageView['series']): FullIn {
  const points = series.filter((p) => known(p.used_bytes));
  if (points.length < 2) return { kind: 'unknown', why: 'Fewer than two days recorded.' };
  const first = points[0];
  const last = points[points.length - 1];
  const elapsed = (Date.parse(last.t) - Date.parse(first.t)) / DAY_MS;
  if (!(elapsed > 0)) return { kind: 'unknown', why: 'Fewer than two days recorded.' };
  const perDay = ((last.used_bytes as number) - (first.used_bytes as number)) / elapsed;
  if (perDay <= 0) return { kind: 'flat' };
  const total = known(last.total_bytes) ? last.total_bytes : lastKnown(series, (p) => p.total_bytes);
  if (total === null) return { kind: 'unknown', why: 'The disk total is not reported.' };
  const free = Math.max(0, total - (last.used_bytes as number));
  return { kind: 'growing', perDay, free, days: free / perDay };
}

/** A duration in days, rounded the way a person says it: "About 14 months". */
export function aboutDuration(days: number): string {
  const count = (n: number, one: string) => `About ${n} ${n === 1 ? one : `${one}s`}`;
  if (days < 1) return 'Less than a day';
  if (days < 14) return count(Math.round(days), 'day');
  if (days < 61) return count(Math.round(days / 7), 'week');
  if (days < 730) return count(Math.round(days / 30.44), 'month');
  if (days < 3652) return count(Math.round(days / 365.25), 'year');
  return 'More than 10 years';
}

// Delivery

export interface CacheTotals {
  served: number | null;
  fromCache: number | null;
  fromStorage: number | null;
  /** From cache ÷ (from cache + from storage), by bytes, over days where both are known. */
  cacheShare: number | null;
  /** Days with a served reading. */
  daysRecorded: number;
}

export function cacheTotals(series: DeliveryView['series']): CacheTotals {
  const both = series.filter((p) => known(p.from_cache_bytes) && known(p.from_storage_bytes));
  const hit = sumKnown(both.map((p) => p.from_cache_bytes));
  const miss = sumKnown(both.map((p) => p.from_storage_bytes));
  return {
    served: sumKnown(series.map((p) => p.served_bytes)),
    fromCache: sumKnown(series.map((p) => p.from_cache_bytes)),
    fromStorage: sumKnown(series.map((p) => p.from_storage_bytes)),
    cacheShare: hit !== null && miss !== null ? ratio(hit, hit + miss) : null,
    daysRecorded: series.filter((p) => known(p.served_bytes)).length,
  };
}

const mostServed = (a: DeliveryNode, b: DeliveryNode) => {
  const x = a.served_bytes;
  const y = b.served_bytes;
  if (!known(x) || !known(y)) return known(x) === known(y) ? a.instance.localeCompare(b.instance) : known(x) ? -1 : 1;
  return y - x || a.instance.localeCompare(b.instance);
};

/** Cache nodes first, then storage nodes that served data; most served first in each. */
export function deliveryOrder(nodes: readonly DeliveryNode[]): DeliveryNode[] {
  const cache = nodes.filter((n) => n.mode === 'cache').sort(mostServed);
  const storage = nodes.filter((n) => isStorageMode(n.mode) && (n.served_bytes ?? 0) > 0).sort(mostServed);
  return [...cache, ...storage];
}

/** The slowest p95 response time among cache nodes that report one. */
export function slowestP95(nodes: readonly DeliveryNode[]): { ms: number; node: DeliveryNode; of: number } | null {
  const reporting = nodes.filter((n) => n.mode === 'cache' && known(n.p95_ms));
  if (!reporting.length) return null;
  const node = reporting.reduce((a, b) => ((b.p95_ms as number) > (a.p95_ms as number) ? b : a));
  return { ms: node.p95_ms as number, node, of: reporting.length };
}

// Inference

/** Requests in flight and requests at once, over the models that have capacity. */
export function nowLoad(models: readonly ModelView[]): { inFlight: number; capacity: number; serving: number } {
  const serving = models.filter((m) => m.ceiling > 0);
  return {
    inFlight: serving.reduce((a, m) => a + m.in_flight, 0),
    capacity: serving.reduce((a, m) => a + m.ceiling, 0),
    serving: serving.length,
  };
}

/** Several point series on one time line: a time one series lacks is a gap (null). */
export function aligned(lists: readonly (readonly Point[])[]): { starts: number[]; values: (number | null)[][] } {
  const starts = [...new Set(lists.flatMap((l) => l.map((p) => Date.parse(p.t))))].sort((a, b) => a - b);
  const values = lists.map((l) => {
    const at = new Map(l.map((p) => [Date.parse(p.t), p.v]));
    return starts.map((t) => at.get(t) ?? null);
  });
  return { starts, values };
}

/** The highest point and its time; the first one on a tie. */
export function peakOf(points: readonly Point[]): { t: string; v: number } | null {
  let best: { t: string; v: number } | null = null;
  for (const p of points) if (known(p.v) && (best === null || p.v > best.v)) best = { t: p.t, v: p.v };
  return best;
}

export type ModelHistory = InferenceHistory['models'][number];

export interface ModelRow {
  name: string;
  versions: string[];
  /** Nodes serving it now; null when the models now could not be read. */
  nodes: ModelOnNode[] | null;
  /** Requests at once now; null when no node lists the model now, or it could not be read. */
  ceiling: number | null;
  inFlight: number | null;
  history: ModelHistory | null;
}

/**
 * One row per model name: the models the nodes list now (versions and buckets
 * of one name added together) joined with the window's history by name.
 * Models with capacity first, then listed with none, then those only in history.
 */
export function joinModels(now: readonly ModelView[] | null, history: readonly ModelHistory[] | null): ModelRow[] {
  const rows = new Map<string, ModelRow>();
  for (const m of now ?? []) {
    const r = rows.get(m.model) ?? { name: m.model, versions: [], nodes: [], ceiling: 0, inFlight: 0, history: null };
    if (m.version && !r.versions.includes(m.version)) r.versions.push(m.version);
    r.nodes = [...(r.nodes ?? []), ...m.nodes];
    r.ceiling = (r.ceiling ?? 0) + m.ceiling;
    r.inFlight = (r.inFlight ?? 0) + m.in_flight;
    rows.set(m.model, r);
  }
  for (const h of history ?? []) {
    const r = rows.get(h.model);
    if (r) {
      if (!r.history) r.history = h;
    } else {
      rows.set(h.model, {
        name: h.model,
        versions: [],
        nodes: now ? [] : null,
        ceiling: null,
        inFlight: null,
        history: h,
      });
    }
  }
  const rank = (r: ModelRow) => (r.ceiling === null ? 2 : r.ceiling > 0 ? 0 : 1);
  return [...rows.values()].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

// Missing readings

/** The `missing` lists of several views as one line: how many did not answer, and why. */
export function missingLine(lists: readonly (readonly SourceError[] | null | undefined)[]): SourceError | null {
  const all = lists.flatMap((l) => l ?? []);
  if (!all.length) return null;
  const why = [...new Set(all.map((e) => e.detail.trim().replace(/\.$/, '')))].filter(Boolean);
  const n = all.length;
  return { source: '', detail: `${n} ${n === 1 ? 'reading' : 'readings'} did not answer: ${why.join('; ')}.` };
}
