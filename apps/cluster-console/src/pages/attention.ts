import type { NodesView, Summary, UsageView } from '~/api/types';

import { billingReason } from './billing';

export interface Attention {
  tag: string;
  tone: 'warn' | 'bad';
  title: string;
  detail: string;
  to: string;
  /** The action's words, e.g. "See nodes". */
  action: string;
}

/** A node the metrics say is near full or silent; filled in by the Overview from the node metrics view. */
export interface NodeSignal {
  name: string;
  /** Disk used share, 0–1, when known. */
  diskUsed?: number | null;
  /** Seconds since the node's last metric sample, when known. */
  silentFor?: number | null;
}

export interface AttentionInputs {
  summary: Summary | null;
  nodes?: NodesView | null;
  usage?: UsageView | null;
  signals?: NodeSignal[];
}

const DISK_FULL = 0.9;
const SILENT_S = 120;

/**
 * "Needs you", worked out from real figures only: a source that did not
 * answer is not guessed at (its page says it is missing). Most severe first.
 */
export function attention({ summary: s, nodes, usage, signals }: AttentionInputs): Attention[] {
  const out: Attention[] = [];

  const sick = nodes?.items.filter((n) => !n.healthy) ?? [];
  if (sick.length > 0) {
    out.push({
      tag: 'Nodes',
      tone: 'bad',
      title: `${sick.length} node${sick.length === 1 ? ' is' : 's are'} not healthy`,
      detail:
        sick
          .map((n) => n.host || n.id)
          .slice(0, 3)
          .join(', ') + (sick.length > 3 ? ` and ${sick.length - 3} more` : ''),
      to: '/nodes',
      action: 'See nodes',
    });
  }
  const silent = signals?.filter((x) => x.silentFor != null && x.silentFor > SILENT_S) ?? [];
  if (silent.length > 0) {
    out.push({
      tag: 'Silent',
      tone: 'warn',
      title: `${silent.length} node${silent.length === 1 ? '' : 's'} stopped reporting`,
      detail: silent
        .map((x) => x.name)
        .slice(0, 3)
        .join(', '),
      to: '/nodes',
      action: 'See nodes',
    });
  }
  const full = (signals ?? []).filter((x) => x.diskUsed != null && x.diskUsed >= DISK_FULL);
  for (const x of full) {
    out.push({
      tag: 'Disk',
      tone: 'warn',
      title: `${x.name} is ${Math.round(100 * (x.diskUsed ?? 0))}% full`,
      detail: 'Storage nodes refuse writes when the disk is full.',
      to: '/storage',
      action: 'See storage',
    });
  }

  const notCounted = usage?.billing.filter((g) => g.state === 'not_counted') ?? [];
  if (notCounted.length > 0) {
    const nodes = new Set(notCounted.flatMap((g) => g.nodes)).size;
    const main = [...notCounted].sort((a, b) => b.billed_cpu_s - a.billed_cpu_s)[0];
    out.push({
      tag: 'Billing',
      tone: 'bad',
      title: 'Sandbox usage isn’t billed',
      detail: billingReason(main.reason, nodes),
      to: '/sandboxes',
      action: 'See sandboxes',
    });
  }

  if (s?.nodes === 0) {
    out.push({
      tag: 'Sandboxes',
      tone: 'warn',
      title: 'No sandbox node is reporting',
      detail: 'The resource manager lists no node with a sandbox runtime, so no sandbox can start.',
      to: '/nodes',
      action: 'See nodes',
    });
  }
  if (s?.cpu && s.cpu.allocatable > 0 && s.cpu.allocated / s.cpu.allocatable >= 0.8) {
    out.push({
      tag: 'Capacity',
      tone: 'warn',
      title: `Sandbox CPU is ${Math.round((100 * s.cpu.allocated) / s.cpu.allocatable)}% requested`,
      detail: `${s.cpu.allocated} of ${s.cpu.allocatable} vCPU requested by running sandboxes.`,
      to: '/sandboxes',
      action: 'See sandboxes',
    });
  }
  if (s?.memory_mib && s.memory_mib.allocatable > 0 && s.memory_mib.allocated / s.memory_mib.allocatable >= 0.8) {
    out.push({
      tag: 'Capacity',
      tone: 'warn',
      title: `Sandbox memory is ${Math.round((100 * s.memory_mib.allocated) / s.memory_mib.allocatable)}% requested`,
      detail: 'New sandboxes may not find room.',
      to: '/sandboxes',
      action: 'See sandboxes',
    });
  }
  const errors = s?.egress_last_hour?.error ?? 0;
  if (errors > 0) {
    out.push({
      tag: 'Egress',
      tone: 'bad',
      title: `${errors} outbound request${errors === 1 ? '' : 's'} failed in the last hour`,
      detail: 'The egress proxy could not reach the host, or a credential was missing.',
      to: '/sandboxes/egress?decision=error',
      action: 'See requests',
    });
  }
  const denied = s?.egress_last_hour?.denied ?? 0;
  if (denied > 0) {
    out.push({
      tag: 'Egress',
      tone: 'warn',
      title: `${denied} outbound request${denied === 1 ? '' : 's'} denied in the last hour`,
      detail: 'A sandbox asked for a host its rules don’t allow.',
      to: '/sandboxes/egress?decision=denied',
      action: 'See requests',
    });
  }
  return out.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'bad' ? -1 : 1));
}
