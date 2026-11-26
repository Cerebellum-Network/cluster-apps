import { describe, expect, it } from 'vitest';

import { fmtDateTime } from './format';
import {
  fmtSpan,
  imageLine,
  keptFiles,
  keptUntilLine,
  parseRetainPaths,
  retainLine,
  shortDigest,
  startedSentence,
  startSteps,
  timeToReady,
} from './lifecycle';
import type { SandboxImage } from './types';

const image = (over: Partial<SandboxImage> = {}): SandboxImage => ({
  ref: 'python:3.12-slim',
  digest: null,
  size_bytes: null,
  cached: null,
  pull_ms: null,
  ...over,
});

const CREATED = '2026-11-26T10:00:00Z';

describe('the start, broken down', () => {
  it('reads created, the image pulled with its time and size, started and ready as the time since the create', () => {
    const steps = startSteps({
      status: 'running',
      created_at: CREATED,
      image: image({ digest: 'sha256:ab', size_bytes: 52_428_800, cached: false, pull_ms: 4200 }),
      started_at: '2026-11-26T10:00:05.100Z',
      ready_at: '2026-11-26T10:00:05.300Z',
    });
    expect(steps.map((s) => [s.label, s.value, s.state])).toEqual([
      ['Created', fmtDateTime(CREATED), 'done'],
      ['Image', 'Pulled in 4.2 s · 50 MiB', 'done'],
      ['Started', '+5.1 s', 'done'],
      ['Ready', '+5.3 s', 'done'],
    ]);
    expect(timeToReady({ created_at: CREATED, ready_at: '2026-11-26T10:00:05.300Z' })).toBe('5.3 s');
  });

  it('says a cached image was found on the node, with its size', () => {
    expect(imageLine(image({ cached: true, pull_ms: 0, size_bytes: 2048 }))).toBe('Cached on the node · 2.0 KiB');
    expect(imageLine(image({ cached: false, pull_ms: 61_000 }))).toBe('Pulled in 1m 01s');
  });

  it('waits for the steps the node has not reported while it starts, and never makes them up', () => {
    const steps = startSteps({
      status: 'starting',
      created_at: CREATED,
      image: image(),
      started_at: null,
      ready_at: null,
    });
    expect(steps.slice(1).map((s) => [s.value, s.state])).toEqual([
      ['Getting it…', 'pending'],
      ['Waiting…', 'pending'],
      ['Waiting…', 'pending'],
    ]);
    expect(timeToReady({ created_at: CREATED, ready_at: null })).toBeNull();
  });

  it('says a sandbox that failed before it ran did not start', () => {
    const steps = startSteps({
      status: 'failed',
      created_at: CREATED,
      image: image(),
      started_at: null,
      ready_at: null,
    });
    expect(steps.find((s) => s.id === 'started')).toMatchObject({ value: 'Did not start', state: 'skipped' });
  });

  it('says in a sentence how it started, from what the node reported', () => {
    const img = image({ cached: false, pull_ms: 4200, size_bytes: 52_428_800 });
    expect(startedSentence({ image: img, startup_ms: 5200 })).toBe(
      'The node pulled the image in 4.2 s (50 MiB); it started in gVisor in 5.2 s.',
    );
    expect(startedSentence({ image: image({ cached: true, pull_ms: 0 }), startup_ms: 900 })).toBe(
      'The image was already on the node; it started in gVisor in 0.9 s.',
    );
    expect(startedSentence({ image: img, startup_ms: null })).toBeNull();
  });

  it('writes short spans in seconds and longer ones in minutes', () => {
    expect(fmtSpan(420)).toBe('0.4 s');
    expect(fmtSpan(12_400)).toBe('12 s');
    expect(fmtSpan(185_000)).toBe('3m 05s');
  });

  it('shortens a digest to tell it apart', () => {
    expect(shortDigest('sha256:3f1c9a0b7d2e5f60718293a4b5c6d7e8f9')).toBe('sha256:3f1c9a0b7d2e');
    expect(shortDigest('abc')).toBe('abc');
  });
});

describe('kept files', () => {
  const sb = {
    retained: [
      { path: '/workspace/output.json', size: 812 },
      { path: '/workspace/out/a.txt', size: 2 },
    ],
    retained_until: '2026-11-27T10:05:00Z',
  };

  it('sums their sizes and says until when they are kept', () => {
    const k = keptFiles(sb, Date.parse('2026-11-26T10:05:00Z'));
    expect(k).toMatchObject({ bytes: 814, expired: false });
    expect(keptUntilLine(k)).toBe(`Kept until ${fmtDateTime(sb.retained_until)}`);
  });

  it('says they are gone once retained_until has passed', () => {
    const k = keptFiles(sb, Date.parse('2026-11-27T10:05:01Z'));
    expect(k.expired).toBe(true);
    expect(keptUntilLine(k)).toBe(`Gone since ${fmtDateTime(sb.retained_until)}`);
  });

  it('says what retain asks for', () => {
    expect(retainLine({ paths: ['/workspace/out/'], on: 'any', ttl_s: 86400 })).toBe('for 24 h after it ends');
    expect(retainLine({ paths: ['/workspace/out/'], on: 'failure', ttl_s: 3600 })).toBe(
      'for 1 h after it ends, if it fails',
    );
  });
});

describe('Keep files, as typed', () => {
  it('takes absolute paths one per line or comma-separated, without repeats', () => {
    expect(parseRetainPaths(' /workspace/a.json\n/workspace/out/, /workspace/a.json \n')).toEqual({
      paths: ['/workspace/a.json', '/workspace/out/'],
      error: null,
    });
    expect(parseRetainPaths('')).toEqual({ paths: [], error: null });
  });

  it('refuses what the API refuses: relative paths, dot segments, /, long paths, more than 32', () => {
    expect(parseRetainPaths('workspace/a').error).toBe('workspace/a is not an absolute path.');
    expect(parseRetainPaths('/workspace/./a').error).toContain('has a . or .. part');
    expect(parseRetainPaths('/workspace/../etc').error).toContain('has a . or .. part');
    expect(parseRetainPaths('/').error).toBe('Name what to keep under /, not / itself.');
    expect(parseRetainPaths(`/${'a'.repeat(1024)}`).error).toBe('A path can be at most 1024 bytes.');
    const many = Array.from({ length: 33 }, (_, i) => `/workspace/f${i}`).join('\n');
    expect(parseRetainPaths(many).error).toBe('At most 32 paths.');
  });
});
