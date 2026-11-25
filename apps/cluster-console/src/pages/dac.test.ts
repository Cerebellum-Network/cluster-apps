import { describe, expect, it } from 'vitest';

import type { ChainSnapshot, DACEra, DACView, NodesView, NodeView } from '~/api/types';

import { byDay, sandboxVerification, workLine, ZERO } from './dac';

const era = (id: number, start: string, status: string, gets: number | null): DACEra => ({
  id,
  status,
  start,
  end: start,
  customers: 1,
  providers: 1,
  consumed: gets === null ? null : { ...ZERO, gets },
  provided: gets === null ? null : { ...ZERO, gets },
});

const node = (id: string, sandbox: boolean): NodeView => ({
  id,
  host: 'h',
  healthy: true,
  last_seen: '',
  modules: [],
  runtimes: [],
  sandbox: sandbox
    ? {
        runtimes: ['gvisor'],
        allocatable: null,
        allocated: null,
        reported_allocated: null,
        sandboxes: null,
        disk_free_gib: null,
      }
    : null,
  inference: null,
  agent: null,
  chain: null,
});

const chain = (...keys: string[]): ChainSnapshot => ({
  cluster_id: 'c',
  manager: 'm',
  reserve: 'r',
  read_at: '',
  extra_managers: [],
  nodes: keys.map((k) => ({ pub_key: k, provider: 'p', host: 'h', http_port: 1, mode: 'compute' })),
});

const dac = (nodes: DACView['nodes']): DACView => ({
  collector: { key: 'k', url: 'u', from: 'blockchain' },
  hours: 24,
  since: '',
  eras: [],
  consumed: ZERO,
  provided: ZERO,
  nodes,
  truncated: false,
  kept_since: '',
  read_at: '',
});

describe('byDay', () => {
  it('groups eras by UTC day, sums only the eras that were read, newest day first', () => {
    const days = byDay([
      era(4, '2026-11-25T00:20:00Z', 'ERA_IN_PROGRESS', null),
      era(3, '2026-11-25T00:00:00Z', 'ERA_PAID', 5),
      era(2, '2026-11-24T23:40:00Z', 'ERA_PAID', null),
      era(1, '2026-11-24T23:20:00Z', 'ERA_PAID', 2),
    ]);
    expect(days.map((d) => d.day)).toEqual(['2026-11-25', '2026-11-24']);
    expect(days[0].statuses).toEqual({ ERA_IN_PROGRESS: 1, ERA_PAID: 1 });
    expect(days[0].consumed?.gets).toBe(5);
    expect(days[0].withUsage).toBe(1);
    expect(days[1].consumed?.gets).toBe(2);
    expect(days[1].withUsage).toBe(1);
  });

  it('leaves a day with no era read as null, not zero', () => {
    expect(byDay([era(1, '2026-11-24T00:00:00Z', 'ERA_PAID', null)])[0].consumed).toBeNull();
  });
});

describe('sandboxVerification', () => {
  const nodes: NodesView = { items: [node('AAA', true), node('bbb', false)], missing: [] };

  it('says why nothing is verified when no sandbox node is on the blockchain', () => {
    const v = sandboxVerification(nodes, chain('bbb'), dac({}));
    expect(v.sandboxNodes).toEqual(['aaa']);
    expect(v.registered).toEqual([]);
    expect(v.verified).toBeNull();
    expect(v.why).toMatch(/not a node of the cluster on the blockchain/);
  });

  it('sums the registered sandbox nodes from DAC', () => {
    const v = sandboxVerification(nodes, chain('0xaaa'), dac({ aaa: { ...ZERO, cpu_units: 7 } }));
    expect(v.registered).toEqual(['aaa']);
    expect(v.verified?.cpu_units).toBe(7);
    expect(v.why).toBeNull();
  });

  it('a registered node with no activity in the window is a real zero', () => {
    const v = sandboxVerification(nodes, chain('aaa'), dac({}));
    expect(v.verified).toEqual(ZERO);
  });
});

describe('workLine', () => {
  it('is null without DAC data and lists only what happened', () => {
    expect(workLine(undefined, String)).toBeNull();
    expect(workLine(ZERO, String)).toBe('no activity');
    expect(workLine({ ...ZERO, gets: 3, transferred_bytes: 10 }, (n) => `${n}B`)).toBe(
      '3 GET · 0 PUT · 10B transferred',
    );
  });
});
