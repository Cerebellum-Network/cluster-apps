import { describe, expect, it } from 'vitest';

import { verdict } from './placement';

const asked = { cpu: 1, memory_mib: 1024 };
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
