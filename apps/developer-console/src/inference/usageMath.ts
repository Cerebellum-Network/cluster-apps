/**
 * The arithmetic behind Inference → Usage, apart from React so it is tested on
 * its own: the window the gateway is asked for, the per-model rows, the four
 * tiles against the previous period, the stacked charts, an opened row's
 * in-flight chart, and when to show the upgrade hint.
 *
 * Ported from ROC (src/features/inferenceLimits/serviceModelUsage.ts,
 * usageCells.ts), without the kind/unit filters and the "by caller" split.
 *
 * # How the numbers are sampled
 *
 * - Totals (tiles, table) are ONE instant `increase(metric[window])` at NOW,
 *   `sum by (model)`, over the whole window; the previous period is the same
 *   read at the window's start. The page never differences points itself.
 * - Charts are range reads of `increase(metric[bar])` at each whole bar's
 *   end, plus one instant read for the partial bar up to now; the legend
 *   totals come from the instant read so they agree with the tiles.
 * - VictoriaMetrics' increase() drops a NEW series' first sample when it is
 *   large (it can't tell a fresh counter from one first seen mid-life), and
 *   the gateway creates its series on first use. Requests (first value 1) and
 *   GPU units survive that; token counts (first value in the thousands) lose
 *   each series' first call. Only the gateway can fix it (increase_pure).
 * - Peaks are `max_over_time(inference_gateway_inflight{state="used"}[w])`
 *   (stat=max on the gateway), the highest of every scraped sample in the
 *   window, not the value a step happens to land on.
 */
import { chartOther, chartPalette } from '~/theme/tokens';
import { nameOf, type Series } from './metricsApi';

export type UsagePreset = '1h' | '24h' | '7d' | '30d';

export const USAGE_PRESETS: Record<UsagePreset, number> = {
  '1h': 3_600_000,
  '24h': 86_400_000,
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
};

export const USAGE_PRESET_KEYS = Object.keys(USAGE_PRESETS) as UsagePreset[];

export const DEFAULT_PRESET: UsagePreset = '7d';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Steps the gateway is asked for. */
const STEPS_MS = [MINUTE, 5 * MINUTE, 15 * MINUTE, 30 * MINUTE, HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR, DAY];

/** Bars per chart, at most. 7d is 168 hourly bars. */
export const MAX_BARS = 180;

/** The smallest step that keeps `spanMs` within `max` points. */
export function pickStep(spanMs: number, max: number): number {
  return STEPS_MS.find((s) => spanMs / s <= max) ?? STEPS_MS[STEPS_MS.length - 1];
}

/** 3_600_000 → "1h", 300_000 → "5m": a duration PromQL and the gateway both accept. */
export function stepString(ms: number): string {
  if (ms % HOUR === 0) return `${ms / HOUR}h`;
  if (ms % MINUTE === 0) return `${ms / MINUTE}m`;
  return `${Math.round(ms / 1000)}s`;
}

/** A step in words: "minute", "15 minutes", "hour", "6 hours", "day". */
export function stepPhrase(ms: number): string {
  const units: Array<[number, string]> = [[DAY, 'day'], [HOUR, 'hour'], [MINUTE, 'minute']];
  for (const [size, word] of units) {
    if (ms % size === 0) {
      const k = ms / size;
      return k === 1 ? word : `${k} ${word}s`;
    }
  }
  return `${Math.round(ms / 1000)} seconds`;
}

export interface UsageWindow {
  /** The window's start, a multiple of `barMs` (VictoriaMetrics aligns range queries the same way). */
  fromMs: number;
  /** The axis end: the end of the bar `nowMs` falls in. The last bar may be partial. */
  toMs: number;
  barMs: number;
  /** When the window was read: totals are evaluated here, so a call made a minute ago is in them. */
  nowMs: number;
  /** The last whole bar boundary at or before `nowMs`: range reads end here, the partial bar is read on its own. */
  wholeToMs: number;
}

/**
 * The window the gateway is asked for: at least `span`, ending NOW. The start
 * is floored to a whole bar so the chart's bars line up; the last bar runs
 * from the last whole boundary to now. Ending at the last whole bar instead
 * (as ROC does) cuts off up to one bar of the most recent usage — 15 minutes
 * on 24h, an hour on 7d — so a model used only recently vanished from the page.
 */
export function usageWindow(preset: UsagePreset, nowMs: number): UsageWindow {
  const span = USAGE_PRESETS[preset];
  const barMs = pickStep(span, MAX_BARS);
  const wholeToMs = Math.floor(nowMs / barMs) * barMs;
  const toMs = wholeToMs === nowMs ? nowMs : wholeToMs + barMs;
  const fromMs = Math.floor((nowMs - span) / barMs) * barMs;
  return { fromMs, toMs, barMs, nowMs, wholeToMs };
}

/** A duration in whole seconds, rounded up, as the gateway's `window` wants it: "90061s". At least 1s. */
export const secondsWindow = (ms: number): string => `${Math.max(1, Math.ceil(ms / 1000))}s`;

/** The period the tiles compare against, in words. */
export const PREVIOUS_LABEL: Record<UsagePreset, string> = {
  '1h': 'previous hour',
  '24h': 'previous 24 hours',
  '7d': 'previous 7 days',
  '30d': 'previous 30 days',
};

/**
 * An instant `sum by (label)` answer as value of `label` → value. Zero,
 * negative and non-finite values are dropped: a model with nothing in the
 * window is not a row. The model label is reduced to its bare name.
 */
export function byLabel(series: Series[], label = 'model'): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of series) {
    const raw = s.labels[label];
    const v = s.points[s.points.length - 1]?.[1];
    if (!raw || v === undefined || !Number.isFinite(v) || v <= 0) continue;
    const key = label === 'model' ? nameOf(raw) : raw;
    out.set(key, (out.get(key) ?? 0) + v);
  }
  return out;
}

type ByModel = Map<string, number>;

/** The instant reads behind the rows, each `sum by (model)`. */
export interface InstantReads {
  gpu: ByModel;
  requests: ByModel;
  tokensIn: ByModel;
  tokensCached: ByModel;
  tokensOut: ByModel;
  /** Highest in flight at once over the window (max_over_time of state="used"). */
  peak: ByModel;
  /** The in-flight limit (state="max"); absent or 0: none. */
  limits: ByModel;
  refusedLimit: ByModel;
  refusedFull: ByModel;
  prev: PrevReads;
}

/** The same reads over the previous window, `sum by (model)`. */
export interface PrevReads { gpu: ByModel; requests: ByModel; refused: ByModel; peak: ByModel }

export interface UsageRow {
  /** The bare model name, as the gateway labels its series. */
  model: string;
  gpu: number;
  requests: number;
  /** Input tokens, cached ones included. */
  tokensIn: number;
  /** Of `tokensIn`, the cached ones; only where the runtime reports them. */
  tokensCached: number;
  tokensOut: number;
  peak: number;
  /** The in-flight limit on this model now; null when none (0) or unknown. */
  limit: number | null;
  /** 429s at the account's own limit. */
  refusedLimit: number;
  /** 429s with the model full. */
  refusedFull: number;
  /** This model's peak in the previous window, for the Closest to limit tile. */
  prevPeak: number;
}

/** Whether a row has any usage in the window. */
export const hasUsage = (r: UsageRow): boolean =>
  r.gpu + r.requests + r.tokensIn + r.tokensOut + r.peak + r.refusedLimit + r.refusedFull > 0;

/**
 * One row per model this account used in the window — GPU units, a request,
 * a token, a refusal, or anything in flight. Never the whole catalogue: a
 * model with only a limit (state="max" exists for every model) is not a row.
 * `fallbackLimits` fills a limit the metrics don't carry (from /limits).
 * Most GPU units first.
 */
export function usageRows(r: InstantReads, fallbackLimits: ByModel = new Map()): UsageRow[] {
  const current = [r.gpu, r.requests, r.tokensIn, r.tokensCached, r.tokensOut, r.peak, r.refusedLimit, r.refusedFull];
  const names = new Set(current.flatMap((m) => [...m.keys()]));
  const get = (m: ByModel, k: string) => m.get(k) ?? 0;
  return [...names]
    .map((model): UsageRow => {
      const limit = get(r.limits, model) || get(fallbackLimits, model);
      return {
        model,
        gpu: get(r.gpu, model),
        requests: Math.round(get(r.requests, model)),
        tokensIn: Math.round(get(r.tokensIn, model)),
        tokensCached: Math.round(get(r.tokensCached, model)),
        tokensOut: Math.round(get(r.tokensOut, model)),
        peak: Math.round(get(r.peak, model)),
        limit: limit > 0 ? limit : null,
        refusedLimit: Math.round(get(r.refusedLimit, model)),
        refusedFull: Math.round(get(r.refusedFull, model)),
        prevPeak: Math.round(get(r.prev.peak, model)),
      };
    })
    .filter(hasUsage)
    .sort((a, b) => b.gpu - a.gpu || b.requests - a.requests || a.model.localeCompare(b.model));
}

/** A total against the previous period. */
export type Change =
  | { kind: 'none' }
  | { kind: 'new' }
  | { kind: 'flat' }
  | { kind: 'up' | 'down'; ratio: number };

/** Below this, a change reads as none: rounding, not a trend. */
const FLAT = 0.0005;

export function change(current: number, previous: number): Change {
  if (previous <= 0) return current > 0 ? { kind: 'new' } : { kind: 'none' };
  const ratio = (current - previous) / previous;
  if (Math.abs(ratio) < FLAT) return { kind: 'flat' };
  return { kind: ratio > 0 ? 'up' : 'down', ratio: Math.abs(ratio) };
}

/** "↑ 18.4% vs the previous 7 days". */
export function changeText(c: Change, prevLabel: string): string {
  switch (c.kind) {
    case 'none': return `None in the ${prevLabel} either`;
    case 'new': return `None in the ${prevLabel}`;
    case 'flat': return `No change vs the ${prevLabel}`;
    default: return `${c.kind === 'up' ? '↑' : '↓'} ${(c.ratio * 100).toFixed(1)}% vs the ${prevLabel}`;
  }
}

const fullNumber = new Intl.NumberFormat('en-US');
export const fmtCount = (v: number): string => fullNumber.format(Math.round(v));

/** A count against the previous period, in requests, not percent: "↑ 65 vs the previous 7 days". */
export function countChangeText(current: number, previous: number, prevLabel: string): { text: string; tone: 'neutral' | 'bad' | 'good' } {
  if (current === 0 && previous === 0) return { text: `None in the ${prevLabel} either`, tone: 'neutral' };
  const diff = current - previous;
  if (diff === 0) return { text: `Same as the ${prevLabel}`, tone: 'neutral' };
  return { text: `${diff > 0 ? '↑' : '↓'} ${fmtCount(Math.abs(diff))} vs the ${prevLabel}`, tone: diff > 0 ? 'bad' : 'good' };
}

export interface Closest {
  model: string;
  peak: number;
  limit: number | null;
  /** Other models at their limit too. */
  othersAtLimit: number;
  prevPeak: number;
}

export interface Tiles {
  gpu: { total: number; change: Change };
  requests: { total: number; change: Change };
  refused: { total: number; limit: number; full: number; prevTotal: number };
  /** Null when nothing was in flight. */
  closest: Closest | null;
}

/**
 * The four tiles for the `rows` in view. Closest to limit is the highest peak
 * against its limit; with no limit known for any model, the busiest.
 *
 * The previous-period totals come from the previous window's reads, narrowed
 * by the same `shown` the rows were: summing them over this period's rows
 * would drop every model used only last period (100 requests on A last week
 * and 50 on B this week is ↓50%, not "None in the previous 7 days").
 */
export function usageTiles(rows: UsageRow[], prev: PrevReads, shown: (model: string) => boolean = () => true): Tiles {
  const sum = (f: (r: UsageRow) => number) => rows.reduce((n, r) => n + f(r), 0);
  const prevSum = (m: ByModel, round = false) =>
    [...m].reduce((n, [model, v]) => (shown(model) ? n + (round ? Math.round(v) : v) : n), 0);
  const gpu = sum((r) => r.gpu);
  const requests = sum((r) => r.requests);
  const busy = rows.filter((r) => r.peak > 0);
  const limited = busy.filter((r) => r.limit !== null);
  const pool = limited.length > 0 ? limited : busy;
  const ratio = (r: UsageRow) => (r.limit ? r.peak / r.limit : r.peak);
  const refusedOf = (r: UsageRow) => r.refusedLimit + r.refusedFull;
  const best = [...pool].sort((a, b) => ratio(b) - ratio(a) || refusedOf(b) - refusedOf(a) || a.model.localeCompare(b.model))[0];
  return {
    gpu: { total: gpu, change: change(gpu, prevSum(prev.gpu)) },
    requests: { total: requests, change: change(requests, prevSum(prev.requests, true)) },
    refused: { total: sum(refusedOf), limit: sum((r) => r.refusedLimit), full: sum((r) => r.refusedFull), prevTotal: prevSum(prev.refused, true) },
    closest: best
      ? {
          model: best.model,
          peak: best.peak,
          limit: best.limit,
          othersAtLimit: rows.filter((r) => r !== best && r.limit !== null && r.peak >= r.limit).length,
          prevPeak: best.prevPeak,
        }
      : null,
  };
}

/** What the page is narrowed to; empty lists mean everything. */
export interface UsageFilter {
  models: string[];
  kinds: string[];
}

export const NO_FILTER: UsageFilter = { models: [], kinds: [] };

/** Whether a model is in view under `f`; `kindOf` names its kind ("Chat", "Embeddings", …). */
export function inView(model: string, f: UsageFilter, kindOf: (model: string) => string): boolean {
  return (f.models.length === 0 || f.models.includes(model)) && (f.kinds.length === 0 || f.kinds.includes(kindOf(model)));
}

/** `list` with `item` added, or removed when already there. */
export const toggle = (list: string[], item: string): string[] => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

export interface ThrottleNotice {
  /** Requests refused at the account's own limit in the window. */
  refused: number;
  /** The plan's in-flight limit those models hit; null when unknown. */
  limit: number | null;
}

/**
 * The upgrade hint: shown only when something was refused at the account's
 * own limit (reason="rate_limited"). Refusals because the model was full
 * (reason="saturated") are not the plan's doing, so they never trigger it.
 * The limit quoted is the highest one among the models refused at it.
 */
export function throttleNotice(rows: UsageRow[]): ThrottleNotice | null {
  const hit = rows.filter((r) => r.refusedLimit > 0);
  if (hit.length === 0) return null;
  const limits = hit.map((r) => r.limit).filter((l): l is number => l !== null);
  return {
    refused: hit.reduce((n, r) => n + r.refusedLimit, 0),
    limit: limits.length > 0 ? Math.max(...limits) : null,
  };
}

/**
 * A range answer `sum by (model)` per bar, on an axis of every bar end in
 * (fromMs, toMs]: an idle bar reads as zero; the sample at `fromMs` — the
 * bar ending there, which belongs to the previous period — is left out.
 */
export function stepsByModel(series: Series[], w: Pick<UsageWindow, 'fromMs' | 'toMs' | 'barMs'>): { startsMs: number[]; byModel: Map<string, number[]> } {
  const startsMs: number[] = [];
  for (let t = w.fromMs + w.barMs; t <= w.toMs; t += w.barMs) startsMs.push(t);
  const index = new Map(startsMs.map((t, i) => [t, i]));
  const out = new Map<string, number[]>();
  for (const s of series) {
    const raw = s.labels.model;
    if (!raw) continue;
    const model = nameOf(raw);
    const data = out.get(model) ?? startsMs.map(() => 0);
    for (const [t, v] of s.points) {
      const i = index.get(t);
      if (i !== undefined && Number.isFinite(v)) data[i] += v;
    }
    out.set(model, data);
  }
  return { startsMs, byModel: out };
}

export interface StackSeries {
  key: string;
  label: string;
  /** Null for the folded "Other" series. */
  model: string | null;
  color: string;
  data: number[];
  total: number;
}

/** Model → colour by rank in `rows` (most GPU units first), the same in both charts and the table. */
export function modelColors(rows: Array<{ model: string }>): Map<string, string> {
  return new Map(rows.map((r, i) => [r.model, chartPalette[i % chartPalette.length]]));
}

/** The most series a chart stacks before folding the rest into Other. */
export const TOP_SERIES = 6;

/**
 * The stacked series: all models when they fit in TOP_SERIES + 1, otherwise
 * the top TOP_SERIES and one "Other (N models)". Totals come from `totals`
 * (the instant read), so the legend says what the tiles say; summing per-bar
 * increases drifts from the one increase over the window.
 */
export function stackSeries(byModel: Map<string, number[]>, totals: ByModel, colorOf: (model: string) => string, length: number): StackSeries[] {
  const ranked = [...byModel.entries()]
    .map(([model, data]) => ({ model, data, sum: data.reduce((a, b) => a + b, 0) }))
    .filter((s) => s.sum > 0 || (totals.get(s.model) ?? 0) > 0)
    .sort((a, b) => (totals.get(b.model) ?? b.sum) - (totals.get(a.model) ?? a.sum) || a.model.localeCompare(b.model));
  const own = (s: { model: string; data: number[]; sum: number }): StackSeries => ({
    key: s.model,
    label: s.model,
    model: s.model,
    color: colorOf(s.model),
    data: s.data,
    total: totals.get(s.model) ?? s.sum,
  });
  if (ranked.length <= TOP_SERIES + 1) return ranked.map(own);
  const top = ranked.slice(0, TOP_SERIES);
  const rest = ranked.slice(TOP_SERIES);
  const data = Array.from({ length }, (_, i) => rest.reduce((n, s) => n + (s.data[i] ?? 0), 0));
  const shown = new Set(top.map((s) => s.model));
  const restTotal = [...totals].filter(([m]) => !shown.has(m)).reduce((a, [, v]) => a + v, 0);
  return [
    ...top.map(own),
    { key: '__other', label: `Other (${rest.length} models)`, model: null, color: chartOther, data, total: restTotal },
  ];
}

const COMPACT: Array<[number, string]> = [[1e9, 'B'], [1e6, 'M'], [1e3, 'k']];

/** A compact count with fixed suffixes: "8.3k", "140M". */
export function compactWords(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  const short = (x: number) => (x < 9.95 ? x.toFixed(1).replace(/\.0$/, '') : String(Math.round(x)));
  const i = COMPACT.findIndex(([size]) => a >= size * 0.9995);
  if (i === -1) return `${sign}${short(a)}`;
  const [size, suffix] = COMPACT[i];
  return `${sign}${short(a / size)}${suffix}`;
}

/** GPU units for a tile or a cell: "2.03M", "392,672", "4.2", "0.0031". */
export function gpuWords(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 10) return fmtCount(v);
  if (v >= 0.1) return v.toFixed(1).replace(/\.0$/, '');
  // A cheap model's calls cost thousandths of a unit: two significant figures, not a "0".
  if (v > 0) return String(Number(v.toPrecision(2)));
  return '0';
}

/** The Refused cell: "3 · your limit", "2 · model full", or both. */
export function refusedCell(row: UsageRow): { text: string; tone: 'none' | 'limit' | 'full' } {
  const { refusedLimit: l, refusedFull: f } = row;
  if (l + f === 0) return { text: '—', tone: 'none' };
  if (l && f) return { text: `${fmtCount(l)} your limit · ${fmtCount(f)} model full`, tone: 'limit' };
  return l ? { text: `${fmtCount(l)} · your limit`, tone: 'limit' } : { text: `${fmtCount(f)} · model full`, tone: 'full' };
}

export interface DetailStep {
  t: number;
  /** The highest in flight in the bar; null when the gauge has no sample (not the same as idle). */
  peak: number | null;
  refusedLimit: number;
  refusedFull: number;
}

/** An opened row's chart: the in-flight peak and the 429s by reason per bar, on the page's axis. */
export function detailSteps(peak: Series[], refused: Series[], w: Pick<UsageWindow, 'fromMs' | 'toMs' | 'barMs'>): DetailStep[] {
  const steps: DetailStep[] = [];
  for (let t = w.fromMs + w.barMs; t <= w.toMs; t += w.barMs) steps.push({ t, peak: null, refusedLimit: 0, refusedFull: 0 });
  const index = new Map(steps.map((s, i) => [s.t, i]));
  for (const s of peak) {
    for (const [t, v] of s.points) {
      const i = index.get(t);
      if (i !== undefined && Number.isFinite(v)) steps[i].peak = (steps[i].peak ?? 0) + Math.round(v);
    }
  }
  for (const s of refused) {
    const field = s.labels.reason === 'rate_limited' ? 'refusedLimit' : s.labels.reason === 'saturated' ? 'refusedFull' : null;
    if (!field) continue;
    for (const [t, v] of s.points) {
      const i = index.get(t);
      if (i !== undefined && Number.isFinite(v)) steps[i][field] += Math.round(v);
    }
  }
  return steps;
}
