import type { Sandbox, SandboxImage } from '~/api/types';
import { bytes, num, plural, seconds, shortTime } from '~/format';

/** A digest as registries show it short: `sha256:` and its first 12 hex digits. */
export function shortDigest(digest: string | null | undefined): string | null {
  if (!digest) return null;
  const m = /^([a-z0-9]+):([0-9a-f]{13,})$/.exec(digest);
  return m ? `${m[1]}:${m[2].slice(0, 12)}` : digest;
}

/** The image's digest and its size on the node, once the node has it: `sha256:1a2b3c4d5e6f · 48.2 MB`. */
export function imageDetail(image: SandboxImage): string | null {
  const parts = [shortDigest(image.digest), image.size_bytes != null ? bytes(image.size_bytes) : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/** How its start went, after the start time: `up in 4,210 ms · image pulled in 3,900 ms`. */
export function startDetail(s: Pick<Sandbox, 'startup_ms' | 'image'>): string | null {
  const parts: string[] = [];
  if (s.startup_ms != null) parts.push(`up in ${num(s.startup_ms, 0)} ms`);
  if (s.image.cached) parts.push('image already on the node');
  else if (s.image.pull_ms != null) parts.push(`image pulled in ${num(s.image.pull_ms, 0)} ms`);
  return parts.length ? parts.join(' · ') : null;
}

/**
 * The files a sandbox keeps after it ends, in one line: what it asks to keep
 * while it runs; once it has ended, the files kept (count and size) and until
 * when, and what was not kept and why. Null for a sandbox that keeps nothing.
 */
export function keptFiles(
  s: Pick<Sandbox, 'ended_at' | 'retain' | 'retained' | 'not_retained' | 'retained_until'>,
  now: number = Date.now(),
): string | null {
  const kept = s.retained ?? [];
  const lost = s.not_retained ?? [];
  if (!s.retain && kept.length === 0 && lost.length === 0) return null;
  if (!s.ended_at) {
    if (!s.retain) return null;
    const when = s.retain.on === 'failure' ? 'if it fails' : 'when it ends';
    return `Keeps ${plural(s.retain.paths.length, 'path')} ${when}, for ${seconds(s.retain.ttl_s)}`;
  }
  const parts: string[] = [];
  if (kept.length) {
    const size = kept.reduce((a, f) => a + f.size, 0);
    let until = '';
    if (s.retained_until) {
      until =
        Date.parse(s.retained_until) <= now
          ? ` · no longer kept, since ${shortTime(s.retained_until)}`
          : ` · until ${shortTime(s.retained_until)}`;
    }
    parts.push(`${plural(kept.length, 'file')}, ${bytes(size)}${until}`);
  } else {
    parts.push('Nothing kept');
  }
  if (lost.length) {
    const reasons = new Set(lost.map((x) => x.reason));
    parts.push(
      reasons.size === 1
        ? `${plural(lost.length, 'path')} not kept: ${lost[0].reason}`
        : `${plural(lost.length, 'path')} not kept`,
    );
  }
  return parts.join(' · ');
}
