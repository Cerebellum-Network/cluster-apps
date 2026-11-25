import { describe, expect, it } from 'vitest';

import type { DeliveryNode, Machine } from '~/api/metricsTypes';
import type { ModelView } from '~/api/types';

import {
  aboutDuration,
  aligned,
  byFullest,
  cacheTotals,
  change,
  deliveryOrder,
  diskTotals,
  fullAtThisRate,
  joinModels,
  lastKnown,
  missingLine,
  nowLoad,
  peakOf,
  ratio,
  slowestP95,
  sumKnown,
} from './serviceMath';

const day = (d: number) => `2026-11-${String(d).padStart(2, '0')}T00:00:00Z`;

const machine = (
  instance: string,
  used: number | null,
  total: number | null,
  extra: Partial<Machine> = {},
): Machine => ({
  key: instance,
  instance,
  host: '',
  mode: 'storage',
  on_chain: true,
  version: null,
  up: true,
  last_seen: null,
  uptime_s: null,
  availability_7d: null,
  cpu_cores: null,
  cpu_used: null,
  memory_total_bytes: null,
  memory_used_bytes: null,
  disk_total_bytes: total,
  disk_used_bytes: used,
  stored_bytes: null,
  served_24h_bytes: null,
  requests_per_s: null,
  cache_hit_bytes_ratio: null,
  cache_hit_requests_ratio: null,
  ...extra,
});

describe('sums and ratios', () => {
  it('sums only known values, and has no sum when none is known', () => {
    expect(sumKnown([1, null, 2, undefined])).toBe(3);
    expect(sumKnown([null, undefined])).toBeNull();
    expect(sumKnown([0, null])).toBe(0);
  });

  it('has no ratio without both parts or with a zero whole', () => {
    expect(ratio(1, 4)).toBe(0.25);
    expect(ratio(null, 4)).toBeNull();
    expect(ratio(1, 0)).toBeNull();
  });

  it('finds the last known value and the change over a window', () => {
    const rows = [{ v: 5 }, { v: 7 }, { v: null }];
    expect(lastKnown(rows, (r) => r.v)).toBe(7);
    expect(lastKnown([{ v: null }], (r) => r.v)).toBeNull();
    expect(change([{ v: null }, { v: 5 }, { v: 9 }, { v: null }], (r) => r.v)).toBe(4);
    expect(change([{ v: 5 }], (r) => r.v)).toBeNull();
  });
});

describe('disk on storage nodes', () => {
  it('sums used and total over nodes that report both, and counts the nearly full', () => {
    const t = diskTotals([machine('a', 950, 1000), machine('b', 100, 1000), machine('c', null, 1000)]);
    expect(t).toEqual({ used: 1050, total: 2000, reporting: 2, nodes: 3, nearlyFull: 1, down: 0 });
  });

  it('has no totals when no node reports its disk', () => {
    expect(diskTotals([machine('a', null, null)])).toMatchObject({ used: null, total: null, reporting: 0 });
  });

  it('counts nodes that are down, not those with no reading', () => {
    expect(diskTotals([machine('a', 1, 2, { up: false }), machine('b', 1, 2, { up: null })]).down).toBe(1);
  });

  it('orders fullest first, nodes without a disk reading last', () => {
    const order = byFullest([machine('low', 1, 10), machine('none', null, 10), machine('high', 9, 10)]);
    expect(order.map((m) => m.instance)).toEqual(['high', 'low', 'none']);
  });
});

describe('full at this rate', () => {
  it('divides the free disk by the daily growth between the first and last readings', () => {
    const r = fullAtThisRate([
      { t: day(1), used_bytes: 100, total_bytes: 1000 },
      { t: day(6), used_bytes: null, total_bytes: 1000 },
      { t: day(11), used_bytes: 200, total_bytes: 1000 },
    ]);
    expect(r).toEqual({ kind: 'growing', perDay: 10, free: 800, days: 80 });
  });

  it('is not growing when use is flat or falls', () => {
    expect(
      fullAtThisRate([
        { t: day(1), used_bytes: 200, total_bytes: 1000 },
        { t: day(2), used_bytes: 150, total_bytes: 1000 },
      ]),
    ).toEqual({ kind: 'flat' });
  });

  it('cannot say with fewer than two readings or no disk total', () => {
    expect(fullAtThisRate([{ t: day(1), used_bytes: 1, total_bytes: 10 }]).kind).toBe('unknown');
    expect(
      fullAtThisRate([
        { t: day(1), used_bytes: 1, total_bytes: null },
        { t: day(2), used_bytes: 2, total_bytes: null },
      ]).kind,
    ).toBe('unknown');
  });

  it('says the time in words a manager reads', () => {
    expect(aboutDuration(0.4)).toBe('Less than a day');
    expect(aboutDuration(1)).toBe('About 1 day');
    expect(aboutDuration(9)).toBe('About 9 days');
    expect(aboutDuration(30)).toBe('About 4 weeks');
    expect(aboutDuration(420)).toBe('About 14 months');
    expect(aboutDuration(1100)).toBe('About 3 years');
    expect(aboutDuration(9000)).toBe('More than 10 years');
  });
});

describe('delivery', () => {
  const node = (instance: string, mode: string, served: number | null, p95: number | null = null): DeliveryNode => ({
    key: instance,
    instance,
    host: '',
    mode,
    served_bytes: served,
    from_cache_ratio: null,
    requests_from_cache_ratio: null,
    p95_ms: p95,
  });

  it('takes the cache share by bytes over days where both parts are known', () => {
    const t = cacheTotals([
      { t: day(1), served_bytes: 100, from_cache_bytes: 90, from_storage_bytes: 10 },
      { t: day(2), served_bytes: 50, from_cache_bytes: 50, from_storage_bytes: null },
      { t: day(3), served_bytes: null, from_cache_bytes: null, from_storage_bytes: null },
    ]);
    expect(t).toEqual({ served: 150, fromCache: 140, fromStorage: 10, cacheShare: 0.9, daysRecorded: 2 });
  });

  it('has no cache share when nothing was served from either', () => {
    expect(
      cacheTotals([{ t: day(1), served_bytes: 0, from_cache_bytes: 0, from_storage_bytes: 0 }]).cacheShare,
    ).toBeNull();
  });

  it('lists cache nodes first, then storage nodes that served data, most served first', () => {
    const order = deliveryOrder([
      node('s-idle', 'storage', 0),
      node('s-busy', 'full', 30),
      node('c-small', 'cache', 5),
      node('c-big', 'cache', 80),
      node('s-none', 'storage', null),
      node('c-quiet', 'cache', null),
    ]);
    expect(order.map((n) => n.instance)).toEqual(['c-big', 'c-small', 'c-quiet', 's-busy']);
  });

  it('takes the slowest p95 among cache nodes that report one', () => {
    const r = slowestP95([
      node('c1', 'cache', 1, 120),
      node('c2', 'cache', 1, 180),
      node('c3', 'cache', 1),
      node('s', 'storage', 1, 900),
    ]);
    expect(r?.ms).toBe(180);
    expect(r?.node.instance).toBe('c2');
    expect(r?.of).toBe(2);
    expect(slowestP95([node('c', 'cache', 1)])).toBeNull();
  });
});

describe('inference', () => {
  const model = (
    name: string,
    ceiling: number,
    inFlight: number,
    nodes = 1,
    extra: Partial<ModelView> = {},
  ): ModelView => ({
    model: name,
    version: 'v1',
    bucket: '1',
    nodes: Array.from({ length: nodes }, (_, i) => ({
      node: `${name}-${i}`,
      host: `${name}-${i}`,
      healthy: true,
      status: 'ready',
      ceiling: ceiling / nodes,
      in_flight: 0,
      queue: 0,
    })),
    ceiling,
    in_flight: inFlight,
    queue: 0,
    ...extra,
  });

  it('adds in flight and capacity over models that have capacity', () => {
    expect(nowLoad([model('a', 16, 3), model('b', 0, 2), model('c', 64, 1)])).toEqual({
      inFlight: 4,
      capacity: 80,
      serving: 2,
    });
  });

  it('lines points up by day, a missing day as a gap', () => {
    const r = aligned([
      [
        { t: day(1), v: 1 },
        { t: day(2), v: 2 },
      ],
      [
        { t: day(2), v: 20 },
        { t: day(3), v: null },
      ],
    ]);
    expect(r.starts).toEqual([Date.parse(day(1)), Date.parse(day(2)), Date.parse(day(3))]);
    expect(r.values).toEqual([
      [1, 2, null],
      [null, 20, null],
    ]);
  });

  it('finds the peak and its day', () => {
    expect(
      peakOf([
        { t: day(1), v: 3 },
        { t: day(2), v: null },
        { t: day(3), v: 8 },
      ]),
    ).toEqual({ t: day(3), v: 8 });
    expect(peakOf([{ t: day(1), v: null }])).toBeNull();
  });

  it('joins models now with their history by name, keeping history-only models last', () => {
    const rows = joinModels(
      [model('glm', 16, 3, 2), model('glm', 8, 1, 1, { version: 'v2' }), model('idle', 0, 0)],
      [
        {
          model: 'glm',
          capacity: 24,
          peak_in_flight: 5,
          refused_model_full: 0,
          refused_customer_limit: 1,
          gpu_units: 0.7,
        },
        {
          model: 'gone',
          capacity: 4,
          peak_in_flight: 1,
          refused_model_full: 0,
          refused_customer_limit: 0,
          gpu_units: 0.1,
        },
      ],
    );
    expect(rows.map((r) => r.name)).toEqual(['glm', 'idle', 'gone']);
    expect(rows[0]).toMatchObject({ ceiling: 24, inFlight: 4, versions: ['v1', 'v2'] });
    expect(rows[0].nodes).toHaveLength(3);
    expect(rows[0].history?.gpu_units).toBe(0.7);
    expect(rows[1].history).toBeNull();
    expect(rows[2]).toMatchObject({ ceiling: null, inFlight: null, nodes: [] });
  });

  it('keeps history rows with nodes unknown when the models now could not be read', () => {
    const rows = joinModels(null, [
      { model: 'glm', capacity: 24, peak_in_flight: 5, refused_model_full: 0, refused_customer_limit: 0, gpu_units: 1 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].nodes).toBeNull();
  });
});

describe('missing readings', () => {
  it('folds the missing lists of several views into one line', () => {
    const line = missingLine([
      [
        { source: 'a', detail: 'timeout' },
        { source: 'b', detail: 'timeout' },
      ],
      undefined,
      [{ source: 'c', detail: 'not configured' }],
    ]);
    expect(line).toEqual({ source: '', detail: '3 readings did not answer: timeout; not configured.' });
    expect(missingLine([[], undefined])).toBeNull();
  });
});
