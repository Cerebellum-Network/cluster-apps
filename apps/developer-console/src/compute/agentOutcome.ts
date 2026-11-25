/**
 * A run's result, recorded on its sandbox. Step 5 terminates the sandbox with
 * a reason that says how the run ended, and the sandbox keeps it as its
 * exit_reason ("terminated by API: <reason>"). The cere CLI
 * (packages/cli/agent/outcome.go), the Python SDK (`cere.run_outcome`) and this
 * console write and read the same reasons, so a run shows the same result
 * whichever client started it and whichever one looks at it.
 */
import type { Sandbox } from './types';

export const REASON_SUCCEEDED = 'agent run succeeded';
export const REASON_FAILED = 'agent run failed';
export const REASON_STOPPED = 'agent run stopped';
/** What clients wrote for every run before results were recorded; the run's output.json holds its result. */
const REASON_LEGACY = 'agent run finished';
export const NOT_RETAINED = ' (files not retained)';
/** The gateway's limit on a terminate reason, in bytes. */
export const MAX_REASON_BYTES = 120;
const BY_API = 'terminated by API: ';

export type OutcomeState = 'running' | 'succeeded' | 'failed' | 'stopped' | 'ended' | 'unknown';

export interface RunOutcome {
  state: OutcomeState;
  /** The error of a failed run, or why the result is what it is. */
  detail?: string;
  /** The client recorded no result: the run's kept output.json decides (`legacyOutcome`). */
  legacy?: boolean;
}

const utf8 = new TextEncoder();

/** `s` cut to at most `n` UTF-8 bytes on a character boundary, ending in "..." when cut. */
export function fitBytes(s: string, n: number): string {
  if (utf8.encode(s).length <= n) return s;
  let out = '';
  for (const ch of s) {
    if (utf8.encode(out + ch).length > n - 3) break;
    out += ch;
  }
  return `${out.trimEnd()}...`;
}

/** The reason step 5 records: stopped, failed with the run's error, or succeeded. */
export function terminateReason(opts: { stopped: boolean; error: string | null }): string {
  if (opts.stopped) return REASON_STOPPED;
  const detail = opts.error?.split(/\s+/).filter(Boolean).join(' ');
  return detail ? fitBytes(`${REASON_FAILED}: ${detail}`, MAX_REASON_BYTES) : REASON_SUCCEEDED;
}

/** `reason` for a delete that keeps no files. */
export function withoutFiles(reason: string): string {
  return fitBytes(reason, MAX_REASON_BYTES - utf8.encode(NOT_RETAINED).length) + NOT_RETAINED;
}

/** A run's result from its sandbox alone. */
export function outcomeOf(sb: Pick<Sandbox, 'status' | 'exit_reason'>): RunOutcome {
  const reason = sb.exit_reason ?? '';
  switch (sb.status) {
    case 'starting':
    case 'running':
      return { state: 'running' };
    case 'unknown':
      return { state: 'unknown', detail: 'The sandbox’s node has not reported for a while.' };
    case 'failed':
      return { state: 'failed', detail: reason || 'The sandbox failed.' };
    default:
      break;
  }
  if (!reason.startsWith(BY_API)) {
    // The sandbox ended by itself under the run, or a kept sandbox ended later.
    if (reason === 'oom_killed' || reason.startsWith('lost:'))
      return { state: 'failed', detail: `The sandbox ended: ${reason}` };
    return { state: 'ended', detail: reason || 'no exit reason' };
  }
  let recorded = reason.slice(BY_API.length);
  if (recorded.endsWith(NOT_RETAINED)) recorded = recorded.slice(0, -NOT_RETAINED.length);
  if (recorded === REASON_SUCCEEDED) return { state: 'succeeded' };
  if (recorded === REASON_STOPPED) return { state: 'stopped', detail: 'Stopped by its client.' };
  if (recorded.startsWith(`${REASON_FAILED}: `))
    return { state: 'failed', detail: recorded.slice(REASON_FAILED.length + 2) };
  if (recorded.startsWith(REASON_LEGACY))
    return { state: 'unknown', detail: 'Its client recorded no result.', legacy: true };
  return { state: 'ended', detail: reason };
}

export const OUTPUT_PATH = '/workspace/output.json';

/**
 * The result of a run whose client recorded none, from what its sandbox kept:
 * no output.json kept means the agent wrote none; else output.json's `error`.
 * `output` is the kept file's text (null when it could not be read).
 */
export function legacyOutcome(sb: Pick<Sandbox, 'retained' | 'exit_reason'>, output: string | null): RunOutcome {
  if (!sb.retained.includes(OUTPUT_PATH)) {
    if ((sb.exit_reason ?? '').includes('files not retained'))
      return { state: 'unknown', detail: 'Its client recorded no result, and its files were not kept.' };
    return { state: 'failed', detail: `The agent wrote no ${OUTPUT_PATH}.` };
  }
  if (output === null) return { state: 'unknown', detail: 'Its output.json is no longer kept.' };
  try {
    const o = JSON.parse(output) as { error?: unknown };
    if (o && typeof o === 'object' && o.error) return { state: 'failed', detail: String(o.error) };
    return { state: 'succeeded' };
  } catch (e) {
    return { state: 'failed', detail: `output.json is not valid JSON: ${(e as Error).message}` };
  }
}

/** How each state reads in a list or a pill. */
export const OUTCOME_LABEL: Record<OutcomeState, string> = {
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
  stopped: 'Stopped',
  ended: 'Ended',
  unknown: 'Unknown',
};
