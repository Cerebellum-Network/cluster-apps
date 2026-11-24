import { describe, expect, it } from 'vitest';

import type { Summary } from '~/api/types';

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

describe('attention', () => {
  it('is empty when everything is fine', () => {
    expect(attention(base)).toEqual([]);
  });

  it('flags unhealthy nodes, failed records and denials', () => {
    const items = attention({
      ...base,
      nodes_healthy: 6,
      records_last_hour: { pushed: 1, pending: 2, failed: 1 },
      egress_last_hour: { allowed: 1, denied: 4, error: 0 },
    });
    expect(items.map((i) => i.title)).toEqual([
      '2 sandbox nodes are not healthy',
      '1 usage record failed to reach the DAC agent in the last hour',
      '2 usage records are still pending',
      '4 egress requests denied in the last hour',
    ]);
  });

  it('never guesses from a missing source', () => {
    expect(
      attention({
        ...base,
        nodes: null,
        nodes_healthy: null,
        records_last_hour: null,
        egress_last_hour: null,
        cpu: null,
      }),
    ).toEqual([]);
  });

  it('flags capacity at 80% and no sandbox node', () => {
    expect(attention({ ...base, cpu: { allocatable: 10, allocated: 8 } })[0].title).toBe(
      'Sandbox CPU is 80% allocated',
    );
    expect(attention({ ...base, nodes: 0, nodes_healthy: 0, cpu: null, memory_mib: null })[0].title).toBe(
      'No sandbox node is reporting',
    );
  });
});
