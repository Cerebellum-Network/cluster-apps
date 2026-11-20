import { describe, it, expect } from 'vitest';

import type { Series } from './metricsApi';
import {
  byLabel,
  change,
  changeText,
  countChangeText,
  detailSteps,
  gpuWords,
  compactWords,
  pickStep,
  refusedCell,
  stackSeries,
  stepString,
  stepsByModel,
  throttleNotice,
  usageRows,
  usageTiles,
  usageWindow,
  MAX_BARS,
  TOP_SERIES,
  type InstantReads,
  type UsageRow,
} from './usageMath';

const H = 3_600_000;
const M = (o: Record<string, number>) => new Map(Object.entries(o));
const instant = (label: string, values: Record<string, number>): Series[] =>
  Object.entries(values).map(([k, v]) => ({ labels: { [label]: k }, points: [[0, v]] }));

const emptyReads = (): InstantReads => ({
  gpu: new Map(), requests: new Map(), tokensIn: new Map(), tokensCached: new Map(), tokensOut: new Map(),
  peak: new Map(), limits: new Map(), refusedLimit: new Map(), refusedFull: new Map(),
  prev: { gpu: new Map(), requests: new Map(), refused: new Map(), peak: new Map() },
});

const row = (o: Partial<UsageRow> & { model: string }): UsageRow => ({
  gpu: 0, requests: 0, tokensIn: 0, tokensCached: 0, tokensOut: 0, peak: 0, limit: null, refusedLimit: 0, refusedFull: 0,
  prev: { gpu: 0, requests: 0, refused: 0, peak: 0 },
  ...o,
});

describe('window and steps', () => {
  it('keeps every preset within MAX_BARS and picks hourly bars for 7d', () => {
    expect(pickStep(7 * 24 * H, MAX_BARS)).toBe(H);
    expect(pickStep(H, MAX_BARS)).toBe(60_000);
    expect(pickStep(30 * 24 * H, MAX_BARS)).toBe(6 * H);
  });

  it('writes steps the gateway parses (no "d")', () => {
    expect(stepString(H)).toBe('1h');
    expect(stepString(24 * H)).toBe('24h');
    expect(stepString(15 * 60_000)).toBe('15m');
  });

  it('ends at the last whole bar and spans the preset exactly', () => {
    const now = Date.UTC(2026, 10, 20, 10, 37);
    const w = usageWindow('24h', now);
    expect(w.barMs).toBe(15 * 60_000);
    expect(w.toMs).toBe(Date.UTC(2026, 10, 20, 10, 30));
    expect(w.toMs - w.fromMs).toBe(24 * H);
  });
});

describe('byLabel', () => {
  it('reads the last point per model, reduces ids to the bare name, drops zeros', () => {
    const series: Series[] = [
      { labels: { model: '1338/glm-5.3/v1' }, points: [[0, 1], [1, 4]] },
      { labels: { model: 'qwen' }, points: [[1, 0]] },
      { labels: {}, points: [[1, 9]] },
    ];
    expect([...byLabel(series)]).toEqual([['glm-5.3', 4]]);
  });
});

describe('usageRows', () => {
  it('lists only models used in the period, never one that only has a limit', () => {
    const r = emptyReads();
    r.requests = byLabel(instant('model', { 'glm-5.3': 12 }));
    r.gpu = byLabel(instant('model', { 'glm-5.3': 3.5 }));
    // inflight{state="max"} exists for every model in the catalogue.
    r.limits = byLabel(instant('model', { 'glm-5.3': 8, 'qwen-3': 8, whisper: 8 }));
    const rows = usageRows(r);
    expect(rows.map((x) => x.model)).toEqual(['glm-5.3']);
    expect(rows[0]).toMatchObject({ requests: 12, gpu: 3.5, limit: 8 });
  });

  it('counts a model that was only refused or only in flight as used', () => {
    const r = emptyReads();
    r.refusedFull = M({ a: 2 });
    r.peak = M({ b: 1 });
    expect(usageRows(r).map((x) => x.model).sort()).toEqual(['a', 'b']);
  });

  it('fills a missing limit from /limits and sorts by GPU units', () => {
    const r = emptyReads();
    r.gpu = M({ small: 1, big: 10 });
    const rows = usageRows(r, M({ small: 20 }));
    expect(rows.map((x) => x.model)).toEqual(['big', 'small']);
    expect(rows[1].limit).toBe(20);
    expect(rows[0].limit).toBeNull();
  });
});

describe('tiles and deltas', () => {
  it('sums the period and compares with the previous one', () => {
    const rows = [
      row({ model: 'a', gpu: 6, requests: 30, prev: { gpu: 4, requests: 30, refused: 1, peak: 2 } }),
      row({ model: 'b', gpu: 6, requests: 10, refusedLimit: 3, refusedFull: 2, prev: { gpu: 6, requests: 10, refused: 0, peak: 0 } }),
    ];
    const t = usageTiles(rows);
    expect(t.gpu.total).toBe(12);
    expect(t.gpu.change).toEqual({ kind: 'up', ratio: 0.2 });
    expect(t.requests.change).toEqual({ kind: 'flat' });
    expect(t.refused).toEqual({ total: 5, limit: 3, full: 2, prevTotal: 1 });
  });

  it('describes changes in words', () => {
    expect(changeText(change(5, 0), 'previous 7 days')).toBe('None in the previous 7 days');
    expect(changeText(change(0, 0), 'previous hour')).toBe('None in the previous hour either');
    expect(changeText(change(50, 100), 'previous 24 hours')).toBe('↓ 50.0% vs the previous 24 hours');
    expect(countChangeText(7, 2, 'previous hour')).toEqual({ text: '↑ 5 vs the previous hour', tone: 'bad' });
    expect(countChangeText(0, 2, 'previous hour').tone).toBe('good');
  });

  it('picks the model closest to its limit by ratio, not by raw peak', () => {
    const t = usageTiles([
      row({ model: 'busy', requests: 1, peak: 10, limit: 20 }),
      row({ model: 'tight', requests: 1, peak: 8, limit: 8, prev: { gpu: 0, requests: 0, refused: 0, peak: 5 } }),
      row({ model: 'full', requests: 1, peak: 4, limit: 4 }),
    ]);
    expect(t.closest).toMatchObject({ model: 'full', peak: 4, limit: 4, othersAtLimit: 1 });
  });

  it('has no closest model when nothing was in flight', () => {
    expect(usageTiles([row({ model: 'a', requests: 1 })]).closest).toBeNull();
  });
});

describe('throttleNotice', () => {
  it('shows only for refusals at the account’s own limit', () => {
    expect(throttleNotice([row({ model: 'a', requests: 5, refusedFull: 9, limit: 8 })])).toBeNull();
    expect(throttleNotice([row({ model: 'a', requests: 5 })])).toBeNull();
  });

  it('counts every refusal at the limit and quotes the highest limit hit', () => {
    expect(
      throttleNotice([
        row({ model: 'a', refusedLimit: 2, limit: 8 }),
        row({ model: 'b', refusedLimit: 1, refusedFull: 4, limit: 20 }),
        row({ model: 'c', refusedFull: 4, limit: 50 }),
      ]),
    ).toEqual({ refused: 3, limit: 20 });
  });

  it('still shows when the limit is unknown', () => {
    expect(throttleNotice([row({ model: 'a', refusedLimit: 1 })])).toEqual({ refused: 1, limit: null });
  });
});

describe('stepsByModel', () => {
  const w = { fromMs: 0, toMs: 3 * H, barMs: H };

  it('puts each bar on the axis (fromMs, toMs] and zero-fills idle bars', () => {
    const series: Series[] = [{ labels: { model: 'a' }, points: [[H, 2], [3 * H, 5]] }];
    const s = stepsByModel(series, w);
    expect(s.startsMs).toEqual([H, 2 * H, 3 * H]);
    expect(s.byModel.get('a')).toEqual([2, 0, 5]);
  });

  it('keeps a series’ first sample inside the window (no differencing)', () => {
    // A model first called in the second bar: its first and only point is that bar's increase.
    const series: Series[] = [{ labels: { model: 'new' }, points: [[2 * H, 1]] }];
    expect(stepsByModel(series, w).byModel.get('new')).toEqual([0, 1, 0]);
  });

  it('drops the sample at fromMs, which belongs to the previous period', () => {
    const series: Series[] = [{ labels: { model: 'a' }, points: [[0, 9], [H, 1]] }];
    expect(stepsByModel(series, w).byModel.get('a')).toEqual([1, 0, 0]);
  });
});

describe('stackSeries', () => {
  const colorOf = () => '#000';

  it('takes legend totals from the instant read', () => {
    const s = stackSeries(new Map(), new Map(), colorOf, 0);
    expect(s).toEqual([]);
    const byModel = new Map([['a', [1, 1]], ['b', [0, 3]]]);
    const out = stackSeries(byModel, M({ a: 2.5, b: 3 }), colorOf, 2);
    expect(out.map((x) => [x.key, x.total])).toEqual([['b', 3], ['a', 2.5]]);
  });

  it('folds models past TOP_SERIES into Other', () => {
    const n = TOP_SERIES + 3;
    const byModel = new Map(Array.from({ length: n }, (_, i) => [`m${i}`, [n - i]] as [string, number[]]));
    const totals = new Map(Array.from({ length: n }, (_, i) => [`m${i}`, n - i] as [string, number]));
    const out = stackSeries(byModel, totals, colorOf, 1);
    expect(out).toHaveLength(TOP_SERIES + 1);
    const other = out[out.length - 1];
    expect(other.label).toBe('Other (3 models)');
    expect(other.data).toEqual([3 + 2 + 1]);
    expect(other.total).toBe(6);
  });
});

describe('detailSteps', () => {
  it('lays peaks and refusals by reason on the page axis; no sample stays null', () => {
    const w = { fromMs: 0, toMs: 2 * H, barMs: H };
    const peak: Series[] = [{ labels: { state: 'used' }, points: [[2 * H, 8]] }];
    const refused: Series[] = [
      { labels: { reason: 'rate_limited' }, points: [[2 * H, 3]] },
      { labels: { reason: 'saturated' }, points: [[H, 1]] },
    ];
    expect(detailSteps(peak, refused, w)).toEqual([
      { t: H, peak: null, refusedLimit: 0, refusedFull: 1 },
      { t: 2 * H, peak: 8, refusedLimit: 3, refusedFull: 0 },
    ]);
  });
});

describe('formatting', () => {
  it('formats GPU units and compact counts', () => {
    expect(gpuWords(0.00312)).toBe('0.0031');
    expect(gpuWords(4.2)).toBe('4.2');
    expect(gpuWords(392672.4)).toBe('392,672');
    expect(gpuWords(2_030_000)).toBe('2.03M');
    expect(compactWords(8300)).toBe('8.3k');
    expect(compactWords(999_600)).toBe('1M');
  });

  it('says which limit refused a request', () => {
    expect(refusedCell(row({ model: 'a' })).text).toBe('—');
    expect(refusedCell(row({ model: 'a', refusedLimit: 2 }))).toEqual({ text: '2 · your limit', tone: 'limit' });
    expect(refusedCell(row({ model: 'a', refusedFull: 1 }))).toEqual({ text: '1 · model full', tone: 'full' });
  });
});
