import { describe, expect, it } from 'vitest';

import type { NodesView, Summary, UsageView } from '~/api/types';

import { attention } from './attention';

const base: Summary = {
  nodes: 8,
  nodes_healthy: 8,
  sandboxes_running: 3,
  cpu: { allocatable: 18, allocated: 3 },
  memory_mib: { allocatable: 34816, allocated: 5120 },
  egress_last_hour: { allowed: 120, denied: 0, error: 0 },
  records_last_hour: { pushed: 180, pending: 0, failed: 0 },
  compute_nodes: 16,
  compute_nodes_by_module: {},
  chain_nodes: 20,
  chain_nodes_by_mode: {},
  sections: {
    sandbox_nodes: { source: '' },
    sandboxes: { source: '' },
    egress: { source: '' },
    records: { source: '' },
    registry: { source: '' },
    chain: { source: '' },
  },
  generated_at: '',
  last_hour_since: '',
};

const usage = (billing: UsageView['billing']): UsageView => ({ billing }) as unknown as UsageView;
const nodesView = (healthy: boolean[]): NodesView =>
  ({
    items: healthy.map((h, i) => ({ id: `n${i}`, host: `10.0.0.${i}`, healthy: h })),
    missing: [],
  }) as unknown as NodesView;

describe('attention', () => {
  it('is empty when everything is fine', () => {
    expect(attention({ summary: base, nodes: nodesView([true, true]) })).toEqual([]);
  });

  it('puts failures first: unhealthy nodes, unbilled usage, then denials', () => {
    const items = attention({
      summary: { ...base, egress_last_hour: { allowed: 1, denied: 4, error: 0 } },
      nodes: nodesView([true, false, false]),
      usage: usage([
        {
          state: 'not_counted',
          reason: 'node_not_on_chain',
          nodes: ['a', 'b'],
          records: 9,
          cpu_s: 1,
          ram_gib_s: 1,
          billed_cpu_s: 9,
          billed_ram_gib_s: 9,
          without_billed: 0,
        },
      ]),
    });
    expect(items.map((i) => i.title)).toEqual([
      '2 nodes are not healthy',
      'Sandbox usage isn’t billed',
      '4 outbound requests denied in the last hour',
    ]);
    expect(items[1].detail).toBe('These 2 nodes are not registered on chain yet, so DAC does not collect their usage.');
    expect(items.some((i) => /DAC agent|pending/.test(i.title))).toBe(false);
  });

  it('never guesses from a missing source', () => {
    expect(
      attention({
        summary: {
          ...base,
          nodes: null,
          nodes_healthy: null,
          records_last_hour: null,
          egress_last_hour: null,
          cpu: null,
        },
        nodes: null,
        usage: null,
      }),
    ).toEqual([]);
    expect(attention({ summary: null })).toEqual([]);
  });

  it('flags capacity at 80%, a full disk, a silent node and no sandbox node', () => {
    expect(attention({ summary: { ...base, cpu: { allocatable: 10, allocated: 8 } } })[0].title).toBe(
      'Sandbox CPU is 80% requested',
    );
    expect(attention({ summary: { ...base, nodes: 0, nodes_healthy: 0, cpu: null, memory_mib: null } })[0].title).toBe(
      'No sandbox node is reporting',
    );
    const t = attention({
      summary: base,
      signals: [
        { name: 'st-1', diskUsed: 0.93 },
        { name: 'st-2', silentFor: 600 },
        { name: 'st-3', diskUsed: 0.5, silentFor: 10 },
      ],
    }).map((i) => i.title);
    expect(t).toEqual(['1 node stopped reporting', 'st-1 is 93% full']);
  });
});
