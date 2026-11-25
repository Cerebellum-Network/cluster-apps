/**
 * Exit reasons in plain words, with what to do about the ones a developer can
 * fix. The node writes the reason (`exit_reason`); the two memory endings are
 * told apart because they are fixed differently: `oom_killed` reached its own
 * memory limit (raise the limit), `memory_reclaimed` used more than its
 * request while its node was short of memory (raise the request: memory
 * within the request is never reclaimed).
 */
import { fmtMib } from './format';
import { EXIT_MEMORY_RECLAIMED, EXIT_OOM_KILLED, EXIT_TOKEN_EXPIRY, type Resources, type Usage } from './types';

export interface ExitReasonInfo {
  /** A few words for a status line: "Out of memory". */
  label: string;
  /** What happened, in a sentence. */
  detail?: string;
  /** What to change so it does not happen again. */
  action?: string;
}

/**
 * `reason` in plain words. `sb` adds the numbers it can (the limit it hit,
 * the request it went over, its peak) when the sandbox is at hand.
 */
export function exitReasonInfo(
  reason: string,
  sb?: {
    resources?: Partial<Pick<Resources, 'memory_mib' | 'memory_limit_mib'>>;
    usage?: Pick<Usage, 'memory_peak_mib'>;
  },
): ExitReasonInfo {
  const request = sb?.resources?.memory_mib;
  const limit = sb?.resources?.memory_limit_mib || request;
  const peak = sb?.usage?.memory_peak_mib;
  if (reason === EXIT_TOKEN_EXPIRY)
    return {
      label: 'Token expired',
      detail: 'Ended 60 s before the access token it was created with expired.',
      action: 'For longer runs, create a new token (Access tokens), or sign in again with cere login.',
    };
  if (reason.startsWith(EXIT_OOM_KILLED))
    return {
      label: 'Out of memory',
      detail: `It reached its memory limit${limit ? ` of ${fmtMib(limit)}` : ''} and was stopped.`,
      action: 'Raise the memory limit.',
    };
  if (reason.startsWith(EXIT_MEMORY_RECLAIMED))
    return {
      label: 'Memory reclaimed',
      detail:
        `It used more memory than its request${request ? ` of ${fmtMib(request)}` : ''}` +
        `${peak && request && peak > request ? ` (up to ${fmtMib(peak)})` : ''}` +
        ' while its node was short of memory, so the node stopped it to free memory.',
      action: 'Raise the memory request to what it uses: memory within the request is never reclaimed.',
    };
  return { label: reason };
}

/** True for the endings that more memory fixes. */
export const memoryEnding = (reason: string | null | undefined): boolean =>
  !!reason && (reason.startsWith(EXIT_OOM_KILLED) || reason.startsWith(EXIT_MEMORY_RECLAIMED));
