import type { Summary } from '~/api/types';

export interface Attention {
  tag: string;
  tone: 'warn' | 'bad';
  title: string;
  detail: string;
  to: string;
}

/**
 * "Needs your attention", worked out from the summary's real counts only. An
 * item whose source is missing is not guessed at; the missing source is shown
 * on its card instead.
 */
export function attention(s: Summary): Attention[] {
  const out: Attention[] = [];
  if (s.nodes !== null && s.nodes_healthy !== null && s.nodes_healthy < s.nodes) {
    const n = s.nodes - s.nodes_healthy;
    out.push({
      tag: 'Nodes',
      tone: 'bad',
      title: `${n} sandbox node${n === 1 ? ' is' : 's are'} not healthy`,
      detail: `${s.nodes_healthy} of ${s.nodes} sandbox nodes report healthy to the resource manager.`,
      to: '/nodes',
    });
  }
  if (s.nodes === 0) {
    out.push({
      tag: 'Nodes',
      tone: 'warn',
      title: 'No sandbox node is reporting',
      detail: 'The resource manager lists no node with a sandbox runtime, so no sandbox can be placed.',
      to: '/nodes',
    });
  }
  if (s.cpu && s.cpu.allocatable > 0 && s.cpu.allocated / s.cpu.allocatable >= 0.8) {
    out.push({
      tag: 'Capacity',
      tone: 'warn',
      title: `Sandbox CPU is ${Math.round((100 * s.cpu.allocated) / s.cpu.allocatable)}% allocated`,
      detail: `${s.cpu.allocated} of ${s.cpu.allocatable} CPU allocated to live sandboxes.`,
      to: '/sandboxes',
    });
  }
  if (s.memory_mib && s.memory_mib.allocatable > 0 && s.memory_mib.allocated / s.memory_mib.allocatable >= 0.8) {
    out.push({
      tag: 'Capacity',
      tone: 'warn',
      title: `Sandbox memory is ${Math.round((100 * s.memory_mib.allocated) / s.memory_mib.allocatable)}% allocated`,
      detail: `${s.memory_mib.allocated} of ${s.memory_mib.allocatable} MiB allocated to live sandboxes.`,
      to: '/sandboxes',
    });
  }
  const failed = s.records_last_hour?.failed ?? 0;
  if (failed > 0) {
    out.push({
      tag: 'DAC',
      tone: 'bad',
      title: `${failed} usage record${failed === 1 ? '' : 's'} failed to reach the DAC agent in the last hour`,
      detail: 'The sandbox runtime keeps them spooled and pushes them again.',
      to: '/sandboxes/usage?dac_status=failed',
    });
  }
  const pending = s.records_last_hour?.pending ?? 0;
  if (pending > 0) {
    out.push({
      tag: 'DAC',
      tone: 'warn',
      title: `${pending} usage record${pending === 1 ? ' is' : 's are'} still pending`,
      detail: 'Written and spooled on the node, not yet accepted by its DAC agent.',
      to: '/sandboxes/usage?dac_status=pending',
    });
  }
  const denied = s.egress_last_hour?.denied ?? 0;
  if (denied > 0) {
    out.push({
      tag: 'Egress',
      tone: 'warn',
      title: `${denied} egress request${denied === 1 ? '' : 's'} denied in the last hour`,
      detail: 'A sandbox asked for a host, method or path its rules do not allow.',
      to: '/sandboxes/egress?decision=denied',
    });
  }
  const errors = s.egress_last_hour?.error ?? 0;
  if (errors > 0) {
    out.push({
      tag: 'Egress',
      tone: 'bad',
      title: `${errors} egress request${errors === 1 ? '' : 's'} failed upstream in the last hour`,
      detail: 'The egress proxy could not reach the host or a credential was missing.',
      to: '/sandboxes/egress?decision=error',
    });
  }
  return out;
}
