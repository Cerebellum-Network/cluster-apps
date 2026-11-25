import type { ChainNode } from '~/api/types';

/**
 * How the cluster's on-chain node records are counted. A storage, full or
 * cache node is a machine; a compute node record is an identity (a key) that
 * a compute service signs its DAC activity with: several can share one host,
 * as the inference operator's key pool does. They are never added into one
 * total.
 */
export const isMachine = (n: Pick<ChainNode, 'mode'>) =>
  n.mode === 'storage' || n.mode === 'full' || n.mode === 'cache';

export interface ComputeGroup {
  /** What runs there, in words: "agent runtime", "inference pool", or the host. */
  role: string;
  hosts: string[];
  keys: string[];
}

/** A compute identity's role, from the host it is registered at. */
export function computeRole(host: string): string {
  const h = host.toLowerCase();
  if (h.includes('agent')) return 'agent runtime';
  if (h.includes('inference')) return 'inference pool';
  return host || 'no host';
}

/** Compute identities grouped by role, largest group first. */
export function computeGroups(nodes: ChainNode[]): ComputeGroup[] {
  const groups = new Map<string, ComputeGroup>();
  for (const n of nodes) {
    if (n.mode !== 'compute') continue;
    const role = computeRole(n.host);
    const g = groups.get(role) ?? { role, hosts: [], keys: [] };
    if (!g.hosts.includes(n.host)) g.hosts.push(n.host);
    g.keys.push(n.pub_key);
    groups.set(role, g);
  }
  return [...groups.values()].sort((a, b) => b.keys.length - a.keys.length || a.role.localeCompare(b.role));
}

export interface NodeCounts {
  /** Storage, full and cache nodes. */
  machines: number;
  byMode: Record<string, number>;
  /** Compute identities on chain. */
  compute: number;
  groups: ComputeGroup[];
}

export function nodeCounts(nodes: ChainNode[]): NodeCounts {
  const byMode: Record<string, number> = {};
  for (const n of nodes) byMode[n.mode] = (byMode[n.mode] ?? 0) + 1;
  return {
    machines: nodes.filter(isMachine).length,
    byMode,
    compute: byMode.compute ?? 0,
    groups: computeGroups(nodes),
  };
}

/** "9 storage and cache nodes · 11 compute identities (8 inference pool, 3 agent runtime)". */
export function nodeLine(c: NodeCounts): string {
  const parts = c.groups.map((g) => `${g.keys.length} ${g.role}`).join(', ');
  return `${c.machines} storage and cache nodes · ${c.compute} compute identities${parts ? ` (${parts})` : ''}`;
}
