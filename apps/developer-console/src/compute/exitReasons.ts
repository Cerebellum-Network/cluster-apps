/**
 * Exit reasons in plain words, with what to do about the ones a developer can
 * fix. The node writes the reason (`exit_reason`) and its class (`exit_kind`);
 * a sandbox is read by its kind, the reason adding the numbers and the detail.
 * The two memory endings are told apart because they are fixed differently:
 * `oom` reached its own memory limit (raise the limit), `memory_reclaimed`
 * used more than its request while its node was short of memory (raise the
 * request: memory within the request is never reclaimed). A usage record
 * carries only the reason; it is read by the reasons that need words.
 */
import { fmtLimit, fmtMib } from './format';
import {
  EXIT_INSUFFICIENT_BALANCE,
  EXIT_MEMORY_RECLAIMED,
  EXIT_OOM_KILLED,
  type ExitKind,
  type Resources,
  type Usage,
} from './types';

export interface ExitReasonInfo {
  /** A few words for a status line: "Out of memory". */
  label: string;
  /** What happened, in a sentence. */
  detail?: string;
  /** What to change so it does not happen again. */
  action?: string;
}

/** What an ending is read from: the kind and code when the sandbox is at hand, its numbers when known. */
export interface ExitContext {
  exit_kind?: ExitKind | null;
  exit_code?: number | null;
  resources?: Partial<Pick<Resources, 'memory' | 'memory_limit' | 'disk'>>;
  usage?: Pick<Usage, 'memory_peak_mib'>;
}

/** Each kind in a few words, for a status line or a filter. */
export const EXIT_KIND_LABEL: Record<ExitKind, string> = {
  main_exited: 'Exited',
  timeout: 'Timed out',
  idle_timeout: 'Idle timeout',
  oom: 'Out of memory',
  memory_reclaimed: 'Memory reclaimed',
  disk_limit: 'Disk full',
  insufficient_balance: 'Out of balance',
  terminated: 'Terminated',
  failed: 'Failed to start',
  lost: 'Lost',
};

/** The seconds in `timeout (300s)`. */
const secondsIn = (reason: string): number | null => {
  const m = /\((\d+)s\)/.exec(reason);
  return m ? Number(m[1]) : null;
};

const sentence = (s: string): string => {
  const t = s.trim();
  return t ? `${t[0].toUpperCase()}${t.slice(1)}${/[.!?]$/.test(t) ? '' : '.'}` : t;
};

const outOfBalance = (): ExitReasonInfo => ({
  label: EXIT_KIND_LABEL.insufficient_balance,
  detail: 'The bucket ran out of balance, so the node stopped it.',
  action: 'Top up in Billing, then start it again.',
});

function outOfMemory(sb?: ExitContext): ExitReasonInfo {
  const limit = sb?.resources?.memory_limit || sb?.resources?.memory;
  return {
    label: EXIT_KIND_LABEL.oom,
    detail: `It reached its memory limit${limit ? ` of ${fmtMib(limit)}` : ''} and was stopped.`,
    action: 'Raise the memory limit.',
  };
}

function memoryReclaimed(sb?: ExitContext): ExitReasonInfo {
  const request = sb?.resources?.memory;
  const peak = sb?.usage?.memory_peak_mib;
  return {
    label: EXIT_KIND_LABEL.memory_reclaimed,
    detail:
      `It used more memory than its request${request ? ` of ${fmtMib(request)}` : ''}` +
      `${peak && request && peak > request ? ` (up to ${fmtMib(peak)})` : ''}` +
      ' while its node was short of memory, so the node stopped it to free memory.',
    action: 'Raise the memory request to what it uses: memory within the request is never reclaimed.',
  };
}

function byKind(kind: ExitKind, reason: string, sb: ExitContext): ExitReasonInfo {
  switch (kind) {
    case 'main_exited': {
      const m = /^exited with code (-?\d+)/.exec(reason);
      const code = sb.exit_code ?? (m ? Number(m[1]) : null);
      return {
        label: code == null ? EXIT_KIND_LABEL.main_exited : `Exited with code ${code}`,
        detail: 'Its main process ended, which ends the sandbox.',
        ...(code != null && code !== 0 ? { action: 'Its logs say why.' } : {}),
      };
    }
    case 'timeout': {
      const s = secondsIn(reason);
      return {
        label: EXIT_KIND_LABEL.timeout,
        detail: `It ran for its whole timeout${s ? ` of ${fmtLimit(s)}` : ''}.`,
        action: 'Give it a longer timeout, or none.',
      };
    }
    case 'idle_timeout': {
      const s = secondsIn(reason);
      return {
        label: EXIT_KIND_LABEL.idle_timeout,
        detail: `Nothing ran in it (no command and no file call) for ${s ? fmtLimit(s) : 'its idle timeout'}.`,
      };
    }
    case 'oom':
      return outOfMemory(sb);
    case 'memory_reclaimed':
      return memoryReclaimed(sb);
    case 'disk_limit':
      return /node disk/.test(reason)
        ? {
            label: EXIT_KIND_LABEL.disk_limit,
            detail: 'Its node’s disk ran low, and this sandbox was using the most of it.',
          }
        : {
            label: EXIT_KIND_LABEL.disk_limit,
            detail: `It wrote past its disk${sb.resources?.disk ? ` of ${fmtMib(sb.resources.disk)}` : ''}.`,
            action: 'Give it more disk.',
          };
    case 'insufficient_balance':
      return outOfBalance();
    case 'terminated': {
      const given = reason.replace(/^terminated by API:?\s*/, '').trim();
      return {
        label: EXIT_KIND_LABEL.terminated,
        detail: given && given !== reason ? `Through the API: ${given}.` : 'Through the API.',
      };
    }
    case 'failed': {
      const given = reason.replace(/^failed:\s*/, '');
      return { label: EXIT_KIND_LABEL.failed, ...(given ? { detail: sentence(given) } : {}) };
    }
    case 'lost':
      return {
        label: EXIT_KIND_LABEL.lost,
        detail: /runtime restarted/.test(reason)
          ? 'Its node’s sandbox runtime restarted while it ran.'
          : /host restarted/.test(reason)
            ? 'Its node’s host restarted while it ran.'
            : sentence(reason || 'Its node lost it'),
      };
    default:
      return { label: reason || kind };
  }
}

/**
 * `reason` in plain words. With the sandbox at hand (`sb`), its `exit_kind`
 * says which ending it was and its numbers (the limit it hit, the request it
 * went over, its peak) are added; a reason alone (a usage record's) gets words
 * for the endings that need them and stays as the node wrote it otherwise.
 */
export function exitReasonInfo(reason: string, sb?: ExitContext): ExitReasonInfo {
  if (sb?.exit_kind) return byKind(sb.exit_kind, reason, sb);
  if (reason === EXIT_INSUFFICIENT_BALANCE) return outOfBalance();
  if (reason.startsWith(EXIT_OOM_KILLED)) return outOfMemory(sb);
  if (reason.startsWith(EXIT_MEMORY_RECLAIMED)) return memoryReclaimed(sb);
  return { label: reason };
}

/** True for the endings that more memory fixes. */
export const memoryEnding = (reason: string | null | undefined): boolean =>
  !!reason && (reason.startsWith(EXIT_OOM_KILLED) || reason.startsWith(EXIT_MEMORY_RECLAIMED));

/** True for the kinds that more memory fixes. */
export const memoryKind = (kind: ExitKind | null | undefined): boolean => kind === 'oom' || kind === 'memory_reclaimed';

/**
 * An exit reason as a sentence for an error line: "Memory reclaimed: it used more memory than its request … Raise the
 * memory request …", or the reason as the node wrote it when there is nothing to add.
 */
export function exitReasonSentence(reason: string, sb?: ExitContext): string {
  const i = exitReasonInfo(reason, sb);
  return i.detail ? `${i.label}: ${[i.detail, i.action].filter(Boolean).join(' ')}` : reason;
}
