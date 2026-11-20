import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadUsage } from './usageReads';
import { usageRows, stepsByModel, usageWindow } from './usageMath';

const MIN = 60_000;
const H = 60 * MIN;
const D = 24 * H;

/** One cumulative counter series, as the gateway's scrape stores it. */
interface Raw { metric: string; labels: Record<string, string>; samples: Array<[number, number]> }

const RESERVED = new Set(['metric', 'from', 'to', 'step', 'groupBy', 'stat', 'window']);
const dur = (s: string) => {
  const n = Number(s.slice(0, -1));
  return s.endsWith('h') ? n * H : s.endsWith('m') ? n * MIN : n * 1000;
};

/**
 * A stand-in for /api/v1/metrics over `raw`: counters only, increase(m[w]) at t
 * is value(t) - value(t - w) with a series worth 0 before its first sample.
 */
function fakeGateway(raw: Raw[], calls: URL[]) {
  return async (input: string) => {
    const url = new URL(input);
    calls.push(url);
    if (url.pathname.endsWith('/limits')) return new Response('{}');
    const p = url.searchParams;
    const matchers = [...p.entries()].filter(([k]) => !RESERVED.has(k));
    const series = raw.filter((r) => r.metric === p.get('metric') && matchers.every(([k, v]) => r.labels[k] === v));
    const value = (r: Raw, t: number) => r.samples.filter(([st]) => st <= t).reduce((_, [, v]) => v, 0);
    const win = dur(p.get('window') ?? '5m');
    const by = p.get('groupBy') ?? '';
    const groups = new Map<string, Raw[]>();
    for (const r of series) groups.set(r.labels[by] ?? '', [...(groups.get(r.labels[by] ?? '') ?? []), r]);
    const at = (rs: Raw[], t: number) => rs.reduce((n, r) => n + value(r, t) - value(r, t - win), 0);
    const result = [...groups].map(([g, rs]) => {
      const metric = by ? { [by]: g } : {};
      if (!p.get('step')) {
        const t = Date.parse(p.get('to')!);
        return { metric, value: [t / 1000, String(at(rs, t))] };
      }
      const values: Array<[number, string]> = [];
      for (let t = Date.parse(p.get('from')!); t <= Date.parse(p.get('to')!); t += dur(p.get('step')!)) values.push([t / 1000, String(at(rs, t))]);
      return { metric, values };
    });
    return new Response(JSON.stringify({ data: { result } }));
  };
}

const req = (model: string, samples: Array<[number, number]>): Raw => ({ metric: 'inference_gateway_requests_total', labels: { model }, samples });

afterEach(() => vi.unstubAllGlobals());

describe('loadUsage over a sparse 7d range', () => {
  const now = Date.UTC(2026, 10, 20, 15, 40, 12);

  it('keeps a model with a single burst in the middle of 7d, in the totals and in one bar', async () => {
    const burst = now - 3.5 * D;
    const calls: URL[] = [];
    vi.stubGlobal('fetch', fakeGateway([req('gemma4_31b', [[now - 6 * D, 1], [now - 1 * D, 2]]), req('glm-5.3', [[burst, 3]])], calls));
    const data = await loadUsage('k', '7d', now, new AbortController().signal);
    const rows = usageRows(data.reads);
    expect(rows.find((r) => r.model === 'glm-5.3')?.requests).toBe(3);
    const bars = stepsByModel(data.requestSteps, data.window).byModel.get('glm-5.3')!;
    expect(bars.filter((v) => v > 0)).toEqual([3]);
  });

  it('counts a call made minutes ago, inside the not-yet-finished bar', async () => {
    // 7d bars are hourly; this call lands 5 minutes after the last whole hour.
    const recent = Math.floor(now / H) * H + 5 * MIN;
    const calls: URL[] = [];
    vi.stubGlobal('fetch', fakeGateway([req('gemma4_31b', [[now - 2 * D, 4]]), req('glm-5.3', [[recent, 2]])], calls));
    for (const preset of ['24h', '7d', '30d'] as const) {
      const data = await loadUsage('k', preset, now, new AbortController().signal);
      expect(usageRows(data.reads).map((r) => r.model).sort()).toEqual(preset === '24h' ? ['glm-5.3'] : ['gemma4_31b', 'glm-5.3']);
      const bars = stepsByModel(data.requestSteps, data.window).byModel.get('glm-5.3')!;
      expect(bars.reduce((a, b) => a + b, 0)).toBe(2);
      if (preset !== '24h') expect(bars[bars.length - 1]).toBe(2); // the partial bar
    }
  });

  it('reads totals at now over the whole window, never at a rounded-down bar', async () => {
    const calls: URL[] = [];
    vi.stubGlobal('fetch', fakeGateway([], calls));
    await loadUsage('k', '24h', now, new AbortController().signal);
    const w = usageWindow('24h', now);
    const totals = calls.filter((u) => u.searchParams.get('metric') === 'inference_gateway_requests_total' && !u.searchParams.get('step'));
    const total = totals.find((u) => u.searchParams.get('groupBy') === 'model' && Date.parse(u.searchParams.get('to')!) === now && dur(u.searchParams.get('window')!) >= w.nowMs - w.fromMs);
    expect(total).toBeDefined();
  });
});
