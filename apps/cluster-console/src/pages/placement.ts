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
export function verdict(c: PlacementCandidate, asked: { cpu: number; memory: number }): Verdict {
  if (c.reason) return { fits: false, why: c.reason, recorded: true };
  const fits = c.fits ?? c.score >= 0;
  if (fits) return { fits: true, why: '', recorded: c.fits !== undefined };
  if (c.free_cpu + 1e-9 < asked.cpu) {
    return { fits: false, why: `not enough CPU: ${cpu(c.free_cpu)} free, ${cpu(asked.cpu)} asked`, recorded: false };
  }
  if (c.free_memory_mib < asked.memory) {
    return {
      fits: false,
      why: `not enough memory: ${mib(c.free_memory_mib)} free, ${mib(asked.memory)} asked`,
      recorded: false,
    };
  }
  return {
    fits: false,
    why: 'not usable; RM did not record why (module not healthy, no gVisor, no endpoint, or already tried)',
    recorded: false,
  };
}

/** Why other nodes didn't take a sandbox, grouped: "4 nodes: not enough memory". */
export interface Refusal {
  why: string;
  nodes: string[];
}

export interface PlacementSummary {
  /** The node it runs on (the accepted attempt, else the sandbox's node). */
  node: string | null;
  /** One sentence: where it was put and why, in plain words. */
  sentence: string;
  /** Nodes that didn't fit, grouped by reason. */
  refused: Refusal[];
  /** Attempts on nodes that refused or failed before the one that took it. */
  retried: { node: string; detail: string }[];
}

const shortWhy = (why: string) =>
  why.replace(/:.*$/, '').replace(/^not usable; RM did not record why.*/, 'no reason recorded');

/**
 * Where a sandbox runs and why, from the resource manager's placement record:
 * RM puts a sandbox on the node with the most free memory after placement,
 * among the nodes with room.
 */
export function placementSummary(
  p:
    | {
        candidates?: PlacementCandidate[];
        attempts?: { node: string; result: string; detail?: string | null }[];
      }
    | null
    | undefined,
  asked: { cpu: number; memory: number },
  fallbackNode: string | null,
  name: (id: string) => string,
): PlacementSummary {
  const accepted = p?.attempts?.find((a) => a.result === 'accepted')?.node ?? null;
  const node = accepted ?? fallbackNode;
  if (!p || !p.candidates?.length) {
    return {
      node,
      sentence: node
        ? `Runs on ${name(node)}. The resource manager kept no placement record for it.`
        : 'Not placed on a node.',
      refused: [],
      retried: [],
    };
  }
  const verdicts = p.candidates.map((c) => ({ c, v: verdict(c, asked) }));
  const fitting = verdicts.filter((x) => x.v.fits);
  const groups = new Map<string, string[]>();
  for (const { c, v } of verdicts) {
    if (v.fits) continue;
    const k = shortWhy(v.why);
    groups.set(k, [...(groups.get(k) ?? []), name(c.node)]);
  }
  const chosen = node ? p.candidates.find((c) => c.node === node) : undefined;
  const room = chosen ? ` (${mib(chosen.free_memory_mib)} and ${cpu(chosen.free_cpu)} free)` : '';
  let sentence: string;
  if (!node) sentence = `No node took it: ${fitting.length} of ${p.candidates.length} nodes had room.`;
  else if (fitting.length <= 1) sentence = `Placed on ${name(node)}: the only node with room${room}.`;
  else
    sentence = `Placed on ${name(node)}: it had the most free memory of the ${fitting.length} nodes with room${room}.`;
  const retried = (p.attempts ?? [])
    .filter((a) => a.result !== 'accepted')
    .map((a) => ({ node: name(a.node), detail: `${a.result}${a.detail ? `: ${a.detail}` : ''}` }));
  return { node, sentence, refused: [...groups.entries()].map(([why, nodes]) => ({ why, nodes })), retried };
}
