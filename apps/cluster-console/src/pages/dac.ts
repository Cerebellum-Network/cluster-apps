import type { ChainSnapshot, DACEra, DACUsage, DACView, NodesView } from '~/api/types';

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

export interface SandboxVerification {
  /** Sandbox node IDs the resource manager reports. */
  sandboxNodes: string[];
  /** Of those, the ones that are nodes of the cluster on the blockchain. */
  registered: string[];
  /** The registered nodes' provided usage over the DAC window; null when none is registered. */
  verified: DACUsage | null;
  /** Why verified is null, in words. */
  why: string | null;
}

/**
 * What DAC verified of the sandbox service's work. DAC collectors ask only
 * nodes of the cluster on the blockchain, so a sandbox node whose ID is not
 * there has its records reach its host's DAC agent and go no further.
 */
export function sandboxVerification(nodes: NodesView, chain: ChainSnapshot, dac: DACView): SandboxVerification {
  const sandboxNodes = nodes.items.filter((n) => n.sandbox).map((n) => n.id.toLowerCase());
  const onChain = new Set(chain.nodes.map((n) => n.pub_key.toLowerCase().replace(/^0x/, '')));
  const registered = sandboxNodes.filter((id) => onChain.has(id));
  if (sandboxNodes.length === 0) {
    return { sandboxNodes, registered, verified: null, why: 'The resource manager reports no sandbox node.' };
  }
  if (registered.length === 0) {
    return {
      sandboxNodes,
      registered,
      verified: null,
      why:
        sandboxNodes.length === 1
          ? 'The sandbox node ID is not a node of the cluster on the blockchain, so DAC collectors never ask for its records: they reach the host’s DAC agent and stop there.'
          : `None of the ${sandboxNodes.length} sandbox node IDs is a node of the cluster on the blockchain, so DAC collectors never ask for their records: they reach the hosts’ DAC agents and stop there.`,
    };
  }
  const verified = registered.reduce((acc, id) => (dac.nodes[id] ? addUsage(acc, dac.nodes[id]) : acc), ZERO);
  return { sandboxNodes, registered, verified, why: null };
}

/** A node's verified work in a short line, or null when DAC has none for it. */
export function workLine(u: DACUsage | undefined, fmtBytes: (n: number) => string): string | null {
  if (!u) return null;
  const parts: string[] = [];
  if (u.gets || u.puts) parts.push(`${u.gets} GET · ${u.puts} PUT`);
  if (u.stored_bytes) parts.push(`${fmtBytes(u.stored_bytes)} stored`);
  if (u.transferred_bytes) parts.push(`${fmtBytes(u.transferred_bytes)} transferred`);
  if (u.cpu_units || u.ram_units) parts.push(`${u.cpu_units} CPU · ${u.ram_units} RAM units`);
  if (u.gpu_units) parts.push(`${u.gpu_units} GPU units`);
  return parts.length ? parts.join(' · ') : 'no activity';
}
