import { describe, it, expect } from 'vitest';

import { timeAxis } from './UsageChart';
import { evenTicks } from './UsageModelsTable';

const HOUR = 3_600_000;

describe('timeAxis', () => {
  it('ticks once per local day with a date label on a 7-day hourly chart', () => {
    const start = new Date(2026, 10, 13, 20).getTime();
    const starts = Array.from({ length: 168 }, (_, i) => start + (i + 1) * HOUR);
    const axis = timeAxis(starts, HOUR);
    expect(axis.ticks).toBeDefined();
    expect(axis.ticks!.length).toBeGreaterThanOrEqual(6);
    expect(axis.ticks!.length).toBeLessThanOrEqual(8);
    for (const t of axis.ticks!) expect(new Date(t).getHours()).toBe(0);
    expect(axis.tick(new Date(2026, 10, 15, 0).getTime())).toBe('Nov 15');
  });

  it('keeps clock labels and lets the chart place ticks within a day', () => {
    const start = new Date(2026, 10, 20, 0).getTime();
    const starts = Array.from({ length: 96 }, (_, i) => start + (i + 1) * 15 * 60_000);
    const axis = timeAxis(starts, 15 * 60_000);
    expect(axis.ticks).toBeUndefined();
    expect(axis.tick(new Date(2026, 10, 20, 9, 30).getTime())).toBe('09:30');
  });
});

describe('evenTicks', () => {
  it('spaces ticks evenly and leaves room above the top', () => {
    expect(evenTicks(8)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(evenTicks(3)).toEqual([0, 1, 2, 3, 4]);
    expect(evenTicks(20)).toEqual([0, 5, 10, 15, 20, 25]);
  });
});
