import type { BillingGroup, BillingState } from '~/api/types';

/**
 * Whether DAC counts the sandbox service's usage, in plain words. The console
 * backend gives each usage record a state and a reason (`GET /api/v1/usage`);
 * these are the words a cluster manager reads.
 */
export const BILLING_LABEL: Record<BillingState, string> = {
  counted: 'Counted',
  waiting: 'Waiting for verification',
  not_counted: 'Not counted',
  unknown: 'Not known yet',
};

export type BillingTone = 'success' | 'primary' | 'warning' | 'neutral';

export const BILLING_TONE: Record<BillingState, BillingTone> = {
  counted: 'success',
  waiting: 'primary',
  not_counted: 'warning',
  unknown: 'neutral',
};

/** One line: why usage is in its state. `nodes` is how many nodes the line speaks for. */
export function billingReason(reason: string, nodes = 1): string {
  const many = nodes > 1;
  switch (reason) {
    case 'verified':
      return 'In a sealed DAC era, with the node’s usage in it.';
    case 'era_open':
      return 'Handed to DAC; the era it falls in is not sealed yet.';
    case 'handoff_pending':
      return 'Written on the node; not yet handed to DAC.';
    case 'handoff_retrying':
      return 'The node is retrying the hand-off to DAC.';
    case 'node_not_on_chain':
      return many
        ? `These ${nodes} nodes are not registered on chain yet, so DAC does not collect their usage.`
        : 'This node is not registered on chain yet, so DAC does not collect its usage.';
    case 'not_in_era_report':
      return many
        ? `DAC sealed the eras without these ${nodes} nodes’ sandbox usage.`
        : 'DAC sealed the era without this node’s sandbox usage.';
    case 'era_skipped':
      return 'DAC skipped the era.';
    case 'chain_unreadable':
      return 'The blockchain could not be read to check the node.';
    case 'dac_unreadable':
      return 'DAC could not be read to check the era.';
    case 'era_report_not_read':
      return 'The era is sealed; this console did not record its report.';
    case 'era_not_listed':
      return 'No era DAC lists covers this usage.';
    default:
      return reason;
  }
}

export interface BillingLine {
  state: BillingState;
  reason: string;
  nodes: number;
  /** Share of the window's billed vCPU-seconds in this state, 0–1. */
  share: number;
  billedCpuS: number;
}

/**
 * The window's billing, largest first: one line per state and reason, with
 * the share of billed CPU it holds. Empty when the window has no usage.
 */
export function billingLines(groups: BillingGroup[]): BillingLine[] {
  const total = groups.reduce((a, g) => a + g.billed_cpu_s, 0);
  return groups
    .map((g) => ({
      state: g.state,
      reason: g.reason,
      nodes: g.nodes.length,
      share: total > 0 ? g.billed_cpu_s / total : groups.length === 1 ? 1 : 0,
      billedCpuS: g.billed_cpu_s,
    }))
    .sort((a, b) => b.billedCpuS - a.billedCpuS || b.nodes - a.nodes);
}
