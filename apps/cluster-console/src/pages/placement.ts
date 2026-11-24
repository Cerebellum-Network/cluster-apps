import type { PlacementCandidate } from '~/api/types';
import { cpu, mib } from '~/format';

export interface Verdict {
  fits: boolean;
  /** Why it did not fit; empty when it fits. */
  why: string;
  /** True when RM recorded the reason; false when worked out here from recorded figures, or unknown. */
  recorded: boolean;
}

/**
 * Whether a candidate fitted and why not, from RM's placement record. RM's
 * `reason` is used when present. Without it, only what the record itself
 * proves is said: a CPU or memory shortfall from the recorded free figures;
 * anything else is "not recorded".
 */
export function verdict(c: PlacementCandidate, asked: { cpu: number; memory_mib: number }): Verdict {
  if (c.reason) return { fits: false, why: c.reason, recorded: true };
  const fits = c.fits ?? c.score >= 0;
  if (fits) return { fits: true, why: '', recorded: c.fits !== undefined };
  if (c.free_cpu + 1e-9 < asked.cpu) {
    return { fits: false, why: `not enough CPU: ${cpu(c.free_cpu)} free, ${cpu(asked.cpu)} asked`, recorded: false };
  }
  if (c.free_memory_mib < asked.memory_mib) {
    return {
      fits: false,
      why: `not enough memory: ${mib(c.free_memory_mib)} free, ${mib(asked.memory_mib)} asked`,
      recorded: false,
    };
  }
  return {
    fits: false,
    why: 'not usable; RM did not record why (module not healthy, no gVisor, no endpoint, or already tried)',
    recorded: false,
  };
}
