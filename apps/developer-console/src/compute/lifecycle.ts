/**
 * A sandbox's start and the files it keeps, in words, from what the API
 * reports: the start broken down (created → image pulled or cached → started
 * → ready), and the files kept after the end until `retained_until`. Nothing
 * is estimated: a step the node has not reported reads as pending.
 */
import { fmtBytes, fmtDateTime, fmtDuration, fmtLimit } from './format';
import type { Retain, RetainedFile, Sandbox, SandboxImage } from './types';

/** A short span: "0.4 s", "4.2 s", "12 s", "3m 05s". */
export function fmtSpan(ms: number): string {
  const s = Math.max(0, ms) / 1000;
  if (s < 10) return `${s.toFixed(1)} s`;
  if (s < 60) return `${Math.round(s)} s`;
  return fmtDuration(s);
}

/** Milliseconds from `from` to `to`, or null when either is missing. */
export function between(from: string | null | undefined, to: string | null | undefined): number | null {
  if (!from || !to) return null;
  const d = Date.parse(to) - Date.parse(from);
  return Number.isFinite(d) ? d : null;
}

/** How the node got the image: "Pulled in 4.2 s · 312 MiB", "Cached on the node · 312 MiB", or null until it says. */
export function imageLine(image: SandboxImage): string | null {
  const size = image.size_bytes != null ? fmtBytes(image.size_bytes) : null;
  if (image.cached) return ['Cached on the node', size].filter(Boolean).join(' · ');
  if (image.pull_ms != null) return [`Pulled in ${fmtSpan(image.pull_ms)}`, size].filter(Boolean).join(' · ');
  return null;
}

/** `sha256:3f1c…` → `sha256:3f1c9a0b7d2e`: enough to tell two digests apart. */
export function shortDigest(digest: string): string {
  const [algo, hex] = digest.includes(':') ? digest.split(':', 2) : ['', digest];
  const short = hex.length > 12 ? hex.slice(0, 12) : hex;
  return algo ? `${algo}:${short}` : short;
}

export type StepState = 'done' | 'pending' | 'skipped';

export interface StartStep {
  id: 'created' | 'image' | 'started' | 'ready';
  label: string;
  /** What to show on the right: a time, a span, or a state. */
  value: string;
  state: StepState;
  /** A longer word for a tooltip. */
  hint?: string;
}

/**
 * The start broken down. Created at a time; the image pulled (with its time
 * and size) or found cached; started and ready, each as the time since the
 * create. A step not reported yet is pending while the sandbox starts, and
 * skipped once it has ended without it.
 */
export function startSteps(
  sb: Pick<Sandbox, 'status' | 'created_at' | 'started_at' | 'ready_at' | 'image'>,
): StartStep[] {
  const starting = sb.status === 'starting' || sb.status === 'unknown';
  const missing = (waiting: string, never: string): Pick<StartStep, 'value' | 'state'> =>
    starting ? { value: waiting, state: 'pending' } : { value: never, state: 'skipped' };
  const image = imageLine(sb.image);
  const sinceCreate = (at: string | null): string | null => {
    const d = between(sb.created_at, at);
    return d == null ? null : `+${fmtSpan(d)}`;
  };
  const started = sinceCreate(sb.started_at);
  const ready = sinceCreate(sb.ready_at);
  return [
    { id: 'created', label: 'Created', value: fmtDateTime(sb.created_at), state: 'done' },
    {
      id: 'image',
      label: 'Image',
      ...(image ? { value: image, state: 'done' as const } : missing('Getting it…', 'Not reported')),
      hint: 'Getting the image is not billed.',
    },
    {
      id: 'started',
      label: 'Started',
      ...(started ? { value: started, state: 'done' as const } : missing('Waiting…', 'Did not start')),
      hint: 'The container started: billing starts here.',
    },
    {
      id: 'ready',
      label: 'Ready',
      ...(ready ? { value: ready, state: 'done' as const } : missing('Waiting…', 'Not reported')),
      hint: 'Its node had it running and said so.',
    },
  ];
}

/**
 * How it started, in a sentence: "The node pulled the image in 4.2 s (50 MiB); it started in gVisor in 5.2 s.", or
 * "The image was already on the node; …". `startup_ms` is the node's own measure, from taking the create to running.
 */
export function startedSentence(sb: Pick<Sandbox, 'image' | 'startup_ms'>): string | null {
  if (sb.startup_ms == null) return null;
  const { cached, pull_ms, size_bytes } = sb.image;
  const image = cached
    ? 'The image was already on the node'
    : pull_ms != null
      ? `The node pulled the image in ${fmtSpan(pull_ms)}${size_bytes != null ? ` (${fmtBytes(size_bytes)})` : ''}`
      : 'The node pulled the image';
  return `${image}; it started in gVisor in ${fmtSpan(sb.startup_ms)}.`;
}

/** "5.3 s to ready", from the create to the node saying it runs; null until it is ready. */
export function timeToReady(sb: Pick<Sandbox, 'created_at' | 'ready_at'>): string | null {
  const d = between(sb.created_at, sb.ready_at);
  return d == null ? null : fmtSpan(d);
}

/** What `retain` asks for, in words: "for 24 h after it ends", "for 1 h after it ends, if it fails". */
export function retainLine(retain: Retain): string {
  return `for ${fmtLimit(retain.ttl_s)} after it ends${retain.on === 'failure' ? ', if it fails' : ''}`;
}

export interface KeptFiles {
  files: RetainedFile[];
  bytes: number;
  until: string | null;
  /** `retained_until` has passed: reading one is 410 `file_gone`. */
  expired: boolean;
}

/** The files a sandbox kept, their total size, and whether they are still kept at `now`. */
export function keptFiles(sb: Pick<Sandbox, 'retained' | 'retained_until'>, now = Date.now()): KeptFiles {
  const until = sb.retained_until;
  return {
    files: sb.retained,
    bytes: sb.retained.reduce((a, f) => a + f.size, 0),
    until,
    expired: !!until && Date.parse(until) <= now,
  };
}

/** "Kept until 27 Nov, 10:05:00 GMT+1", or "Gone since …" once `retained_until` has passed. */
export function keptUntilLine(k: Pick<KeptFiles, 'until' | 'expired'>): string | null {
  if (!k.until) return null;
  return k.expired ? `Gone since ${fmtDateTime(k.until)}` : `Kept until ${fmtDateTime(k.until)}`;
}

/** The most paths `retain` takes, and the longest. */
export const RETAIN_MAX_PATHS = 32;
export const RETAIN_MAX_PATH_BYTES = 1024;

/**
 * "Keep files" as typed: absolute paths, one per line or comma-separated, without repeats. A path may be a directory
 * (everything under it is kept). The API's rules: 1 to 32 paths, each absolute, at most 1024 bytes, not `/`, without
 * `.` or `..` segments.
 */
export function parseRetainPaths(input: string): { paths: string[]; error: string | null } {
  const paths: string[] = [];
  for (const raw of input.split(/[\n,]/)) {
    const p = raw.trim();
    if (p && !paths.includes(p)) paths.push(p);
  }
  const utf8 = new TextEncoder();
  for (const p of paths) {
    if (!p.startsWith('/')) return { paths, error: `${p} is not an absolute path.` };
    if (p.replace(/\/+$/, '') === '') return { paths, error: 'Name what to keep under /, not / itself.' };
    if (p.split('/').some((seg) => seg === '.' || seg === '..'))
      return { paths, error: `${p} has a . or .. part; write the path out.` };
    if (utf8.encode(p).length > RETAIN_MAX_PATH_BYTES)
      return { paths, error: `A path can be at most ${RETAIN_MAX_PATH_BYTES} bytes.` };
  }
  if (paths.length > RETAIN_MAX_PATHS) return { paths, error: `At most ${RETAIN_MAX_PATHS} paths.` };
  return { paths, error: null };
}
