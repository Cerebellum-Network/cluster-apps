import { describe, expect, it } from 'vitest';

import type { LiveSandbox } from '~/api/types';

import { amountsSplit, billedOf, billingBasisWords, exitReasonWords, laneOf, limitsOf, resourceUse } from './limits';

const sbx = (
  id: string,
  resources: LiveSandbox['resources'],
  live: { cpu: number; memory_mib: number } | null,
): Pick<LiveSandbox, 'id' | 'resources' | 'live'> => ({
  id,
  resources,
  live: live
    ? { ...live, memory_peak_mib: 0, period_start: '', period_end: '', source: 'node metrics', cpu_peak: null }
    : null,
});

describe('limitsOf', () => {
  it('limits a sandbox from before limits at its request', () => {
    expect(limitsOf({ cpu: 1, memory_mib: 1024 })).toEqual({
      cpu: 1,
      memoryMiB: 1024,
      cpuLimit: 1,
      memoryLimitMiB: 1024,
    });
    expect(limitsOf({ cpu: 1, memory_mib: 512, cpu_limit: null, memory_limit_mib: 0 })).toMatchObject({
      cpuLimit: 1,
      memoryLimitMiB: 512,
    });
  });

  it('keeps the limits a sandbox reports, never below its request', () => {
    expect(limitsOf({ cpu: 0.25, memory_mib: 256, cpu_limit: 4, memory_limit_mib: 1024 })).toEqual({
      cpu: 0.25,
      memoryMiB: 256,
      cpuLimit: 4,
      memoryLimitMiB: 1024,
    });
    expect(limitsOf({ cpu: 2, memory_mib: 256, cpu_limit: 1 }).cpuLimit).toBe(2);
  });
});

describe('resourceUse', () => {
  it('splits use into the part within the request and the burst above it', () => {
    const u = resourceUse(
      sbx('a', { cpu: 0.25, memory_mib: 256, cpu_limit: 4, memory_limit_mib: 1024 }, { cpu: 1, memory_mib: 300 }),
      'cpu',
    );
    expect(u).toEqual({ request: 0.25, limit: 4, used: 1, within: 0.25, burst: 0.75, canBurst: true });
    const m = resourceUse(
      sbx('a', { cpu: 0.25, memory_mib: 256, cpu_limit: 4, memory_limit_mib: 1024 }, { cpu: 1, memory_mib: 300 }),
      'memory',
    );
    expect(m.burst).toBeCloseTo(44);
    expect(m.within).toBe(256);
  });

  it('reads a sandbox limited at its request as never bursting', () => {
    const u = resourceUse(sbx('a', { cpu: 1, memory_mib: 1024 }, { cpu: 1.02, memory_mib: 400 }), 'cpu');
    expect(u.canBurst).toBe(false);
    expect(u.burst).toBe(0);
    expect(u.within).toBe(1);
    expect(u.used).toBe(1.02);
  });

  it('draws no burst past the limit, and none without a reading', () => {
    expect(
      resourceUse(sbx('a', { cpu: 0.5, memory_mib: 256, cpu_limit: 1 }, { cpu: 1.04, memory_mib: 1 }), 'cpu').burst,
    ).toBe(0.5);
    expect(resourceUse(sbx('a', { cpu: 0.5, memory_mib: 256, cpu_limit: 1 }, null), 'cpu')).toMatchObject({
      used: null,
      within: 0,
      burst: 0,
    });
  });
});

describe('laneOf', () => {
  it('puts each sandbox’s burst right after its own block', () => {
    const lane = laneOf(
      [
        sbx('a', { cpu: 1, memory_mib: 1024 }, { cpu: 0.5, memory_mib: 100 }),
        sbx('b', { cpu: 0.25, memory_mib: 256, cpu_limit: 4 }, { cpu: 1, memory_mib: 200 }),
        sbx('c', { cpu: 0.5, memory_mib: 256, cpu_limit: 2 }, null),
      ],
      'cpu',
    );
    expect(lane.parts.map((p) => [p.id, p.start, p.request, p.within, p.burst])).toEqual([
      ['a', 0, 1, 0.5, 0],
      ['b', 1, 0.25, 0.25, 0.75],
      ['c', 2, 0.5, 0, 0],
    ]);
    expect(lane.requested).toBe(1.75);
    expect(lane.used).toBe(1.5);
    expect(lane.burst).toBe(0.75);
    expect(lane.end).toBe(2.5);
  });

  it('works in another unit', () => {
    const lane = laneOf(
      [sbx('a', { cpu: 1, memory_mib: 512, memory_limit_mib: 2048 }, { cpu: 0, memory_mib: 1024 })],
      'memory',
      1024,
    );
    expect(lane.requested).toBe(0.5);
    expect(lane.burst).toBe(0.5);
    expect(lane.end).toBe(1);
  });
});

describe('billed split', () => {
  it('takes the burst a sandbox reports', () => {
    expect(
      billedOf({
        wall_s: 60,
        cpu_s: 60,
        ram_gib_s: 1,
        memory_peak_mib: 0,
        net_egress_bytes: 0,
        net_ingress_bytes: 0,
        disk_peak_mib: 0,
        billing_basis: 'request_or_usage',
        reserved_cpu_s: 15,
        billed_cpu_s: 60,
        burst_cpu_s: 45,
        reserved_ram_gib_s: 15,
        billed_ram_gib_s: 15,
        burst_ram_gib_s: 0,
      }),
    ).toEqual({ cpu: { billed: 60, floor: 15, burst: 45 }, memory: { billed: 15, floor: 15, burst: 0 } });
  });

  it('works out the burst of older usage, and none on measured use', () => {
    const base = {
      wall_s: 60,
      cpu_s: 3,
      ram_gib_s: 1,
      memory_peak_mib: 0,
      net_egress_bytes: 0,
      net_ingress_bytes: 0,
      disk_peak_mib: 0,
    };
    expect(billedOf({ ...base, billing_basis: 'reserved', reserved_cpu_s: 60, billed_cpu_s: 70 }).cpu).toEqual({
      billed: 70,
      floor: 60,
      burst: 10,
    });
    expect(billedOf({ ...base, billing_basis: 'measured', reserved_cpu_s: 60, billed_cpu_s: 3 }).cpu).toEqual({
      billed: 3,
      floor: 3,
      burst: 0,
    });
    expect(billedOf(base)).toEqual({ cpu: null, memory: null });
    expect(billedOf(null)).toEqual({ cpu: null, memory: null });
  });

  it('reads summed usage from a backend before limits as all floor', () => {
    const a = { records: 1, cpu_s: 1, ram_gib_s: 1, billed_cpu_s: 10, billed_ram_gib_s: 4, without_billed: 0 };
    expect(amountsSplit(a).cpu).toEqual({ billed: 10, floor: 10, burst: 0 });
    expect(amountsSplit({ ...a, floor_cpu_s: 6, burst_cpu_s: 4 }).cpu).toEqual({ billed: 10, floor: 6, burst: 4 });
  });
});

describe('words', () => {
  it('names the billing basis without its wire name', () => {
    expect(billingBasisWords('request_or_usage')).toMatch(/request, or for its use when above it/);
    expect(billingBasisWords('measured')).toBe('Billed for what it used');
    expect(billingBasisWords('')).toBeNull();
  });

  it('says why a sandbox ended in plain words', () => {
    expect(exitReasonWords('oom_killed')).toBe('Out of memory: it reached its memory limit');
    expect(exitReasonWords('memory_reclaimed')).toMatch(
      /^Memory reclaimed: .*more than its memory request.*short of memory$/,
    );
    expect(exitReasonWords('timeout (600s)')).toBe('Reached its time limit (600 s)');
    expect(exitReasonWords('exited with code 0')).toBe('Finished');
    expect(exitReasonWords('exited with code 137')).toBe('Exited with code 137');
    expect(exitReasonWords('failed: image pull image not found or access denied')).toBe(
      'Couldn’t pull its image: image not found or access denied',
    );
    expect(exitReasonWords('disk_limit (2048 MiB)')).toBe('Reached its disk limit (2048 MiB)');
    expect(exitReasonWords('something new')).toBe('something new');
    expect(exitReasonWords(null)).toBeNull();
  });
});
