import { describe, expect, it } from 'vitest';

import { verdict } from './placement';

const asked = { cpu: 1, memory: 1024 };
const c = (
  o: Partial<{ free_cpu: number; free_memory_mib: number; score: number; fits: boolean; reason: string }>,
) => ({
  node: 'n',
  free_cpu: 4,
  free_memory_mib: 8192,
  score: 7168,
  ...o,
});

describe('placement verdict', () => {
  it('uses the reason RM recorded', () => {
    expect(verdict(c({ score: -1, fits: false, reason: 'no gvisor runtime' }), asked)).toEqual({
      fits: false,
      why: 'no gvisor runtime',
      recorded: true,
    });
  });
  it('reads a non-negative score as a fit', () => {
    expect(verdict(c({}), asked).fits).toBe(true);
    expect(verdict(c({ score: 0, free_memory_mib: 1024 }), asked).fits).toBe(true);
  });
  it('derives only CPU and memory shortfalls from the recorded figures', () => {
    expect(verdict(c({ score: -1, free_cpu: 0.5 }), asked).why).toBe('not enough CPU: 0.5 CPU free, 1 CPU asked');
    expect(verdict(c({ score: -1, free_memory_mib: 512 }), asked).why).toBe(
      'not enough memory: 512 MiB free, 1 GiB asked',
    );
    const other = verdict(c({ score: -1 }), asked);
    expect(other.fits).toBe(false);
    expect(other.recorded).toBe(false);
    expect(other.why).toContain('RM did not record why');
  });
});

describe('placement summary', () => {
  const name = (id: string) => `host-${id}`;
  it('says where and why in one sentence, and groups the nodes that had no room', async () => {
    const { placementSummary } = await import('./placement');
    const s = placementSummary(
      {
        candidates: [
          { node: 'a', free_cpu: 4, free_memory_mib: 8192, score: 7168 },
          { node: 'b', free_cpu: 4, free_memory_mib: 4096, score: 3072 },
          { node: 'c', free_cpu: 0.5, free_memory_mib: 512, score: -1 },
          { node: 'd', free_cpu: 0.5, free_memory_mib: 512, score: -1 },
        ],
        attempts: [{ node: 'a', result: 'accepted' }],
      },
      asked,
      null,
      name,
    );
    expect(s.node).toBe('a');
    expect(s.sentence).toBe(
      'Placed on host-a: it had the most free memory of the 2 nodes with room (8 GiB and 4 CPU free).',
    );
    expect(s.refused).toEqual([{ why: 'not enough CPU', nodes: ['host-c', 'host-d'] }]);
    expect(s.retried).toEqual([]);
  });
  it('mentions a node that refused before the one that took it', async () => {
    const { placementSummary } = await import('./placement');
    const s = placementSummary(
      {
        candidates: [c({ node: 'x' } as never), { ...c({}), node: 'y' }],
        attempts: [
          { node: 'x', result: 'rejected', detail: 'busy' },
          { node: 'y', result: 'accepted' },
        ],
      },
      asked,
      null,
      name,
    );
    expect(s.node).toBe('y');
    expect(s.retried).toEqual([{ node: 'host-x', detail: 'rejected: busy' }]);
  });
  it('without a record, says only where it runs', async () => {
    const { placementSummary } = await import('./placement');
    expect(placementSummary(null, asked, 'z', name).sentence).toBe(
      'Runs on host-z. The resource manager kept no placement record for it.',
    );
  });
});
