import type { DACEra, DACUsage } from '~/api/types';

export const ZERO: DACUsage = {
  puts: 0,
  gets: 0,
  stored_bytes: 0,
  transferred_bytes: 0,
  cpu_units: 0,
  ram_units: 0,
  gpu_units: 0,
  compute_count: 0,
};

export function addUsage(a: DACUsage, b: DACUsage): DACUsage {
  return {
    puts: a.puts + b.puts,
    gets: a.gets + b.gets,
    stored_bytes: a.stored_bytes + b.stored_bytes,
    transferred_bytes: a.transferred_bytes + b.transferred_bytes,
    cpu_units: a.cpu_units + b.cpu_units,
    ram_units: a.ram_units + b.ram_units,
    gpu_units: a.gpu_units + b.gpu_units,
    compute_count: a.compute_count + b.compute_count,
  };
}

const STATUS: Record<string, string> = {
  ERA_IN_PROGRESS: 'In progress',
  ERA_EMPTY: 'Empty',
  ERA_PROCESSED: 'Processed',
  ERA_INSPECTED: 'Inspected',
  ERA_PAID: 'Paid',
  ERA_FORCED_SKIPPED: 'Skipped',
};

/** DAC's era status in words. */
export const eraStatus = (s: string) => STATUS[s] ?? s;

export interface Day {
  /** UTC date, YYYY-MM-DD. */
  day: string;
  eras: DACEra[];
  /** Era count by status. */
  statuses: Record<string, number>;
  /** Sum over the eras whose usage was read; null when none was. */
  consumed: DACUsage | null;
  withUsage: number;
}

/** Eras (newest first) grouped by the UTC day they started, newest day first. */
export function byDay(eras: DACEra[]): Day[] {
  const days = new Map<string, Day>();
  for (const e of eras) {
    const day = e.start.slice(0, 10);
    let d = days.get(day);
    if (!d) {
      d = { day, eras: [], statuses: {}, consumed: null, withUsage: 0 };
      days.set(day, d);
    }
    d.eras.push(e);
    d.statuses[e.status] = (d.statuses[e.status] ?? 0) + 1;
    if (e.consumed) {
      d.consumed = addUsage(d.consumed ?? ZERO, e.consumed);
      d.withUsage++;
    }
  }
  return [...days.values()].sort((a, b) => b.day.localeCompare(a.day));
}
