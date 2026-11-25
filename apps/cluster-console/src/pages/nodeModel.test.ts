import { describe, expect, it } from 'vitest';

import type { ChainNode } from '~/api/types';

import { computeGroups, nodeCounts, nodeLine } from './nodeModel';

const n = (mode: string, host: string, key: string): ChainNode => ({
  pub_key: key,
  provider: 'p',
  host,
  http_port: 8080,
  mode,
});

/** Devnet's cluster 7f82864e… on 25 Nov: 9 machines and 11 compute identities. */
const devnet: ChainNode[] = [
  ...[
    '37.27.30.47',
    '178.251.228.165',
    '49.13.211.157',
    '178.251.228.49',
    '159.69.207.65',
    '95.217.8.119',
    '178.251.228.42',
  ].map((h, i) => n('storage', h, `s${i}`)),
  n('full', '178.251.228.236', 'f0'),
  n('cache', '178.251.228.44', 'c0'),
  ...[0, 1, 2].map((i) => n('compute', `dac-agent-${i}.compute.dev.ddcdragon.com`, `a${i}`)),
  ...Array.from({ length: 8 }, (_, i) => n('compute', 'inference-operator.compute.dev.ddcdragon.com', `i${i}`)),
];

describe('node counts', () => {
  it('counts machines and compute identities apart, never as one total', () => {
    const c = nodeCounts(devnet);
    expect(c.machines).toBe(9);
    expect(c.compute).toBe(11);
    expect(nodeLine(c)).toBe('9 storage and cache nodes · 11 compute identities (8 inference pool, 3 agent runtime)');
  });
  it('groups compute identities by what runs at their host', () => {
    const g = computeGroups(devnet);
    expect(g.map((x) => [x.role, x.keys.length, x.hosts.length])).toEqual([
      ['inference pool', 8, 1],
      ['agent runtime', 3, 3],
    ]);
    expect(computeGroups([n('compute', 'gpu.example', 'k')])[0].role).toBe('gpu.example');
  });
});
