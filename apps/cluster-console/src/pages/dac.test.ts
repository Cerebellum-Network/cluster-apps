import { describe, expect, it } from 'vitest';

import type { DACEra } from '~/api/types';

import { byDay, ZERO } from './dac';

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
