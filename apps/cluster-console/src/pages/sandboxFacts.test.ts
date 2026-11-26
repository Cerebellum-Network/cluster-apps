import { describe, expect, it } from 'vitest';

import type { Sandbox, SandboxImage } from '~/api/types';

import { imageDetail, keptFiles, shortDigest, startDetail } from './sandboxFacts';

const DIGEST = 'sha256:1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b';
const img = (o: Partial<SandboxImage> = {}): SandboxImage => ({
  ref: 'python:3.12-slim',
  digest: null,
  size_bytes: null,
  cached: null,
  pull_ms: null,
  ...o,
});

describe('image', () => {
  it('shows a digest short, and its size once the node has it', () => {
    expect(shortDigest(DIGEST)).toBe('sha256:1a2b3c4d5e6f');
    expect(shortDigest(null)).toBeNull();
    expect(imageDetail(img({ digest: DIGEST, size_bytes: 48_200_000 }))).toBe('sha256:1a2b3c4d5e6f · 48.2 MB');
    expect(imageDetail(img())).toBeNull();
  });

  it('breaks the start down: up in, then pulled or already on the node', () => {
    expect(startDetail({ startup_ms: 4210, image: img({ cached: false, pull_ms: 3900 }) })).toBe(
      'up in 4,210 ms · image pulled in 3,900 ms',
    );
    expect(startDetail({ startup_ms: 900, image: img({ cached: true, pull_ms: 0 }) })).toBe(
      'up in 900 ms · image already on the node',
    );
    expect(startDetail({ startup_ms: null, image: img() })).toBeNull();
  });
});

type Kept = Pick<Sandbox, 'ended_at' | 'retain' | 'retained' | 'not_retained' | 'retained_until'>;
const none: Kept = { ended_at: null, retain: null, retained: [], not_retained: [], retained_until: null };
const NOW = Date.parse('2026-11-26T12:00:00Z');

describe('keptFiles', () => {
  it('says nothing for a sandbox that keeps nothing', () => {
    expect(keptFiles(none, NOW)).toBeNull();
    expect(keptFiles({ ...none, ended_at: '2026-11-26T10:00:00Z' }, NOW)).toBeNull();
  });

  it('says what a running sandbox will keep', () => {
    expect(keptFiles({ ...none, retain: { paths: ['/workspace/out/'], on: 'any', ttl_s: 3600 } }, NOW)).toBe(
      'Keeps 1 path when it ends, for 1h 0m',
    );
    expect(keptFiles({ ...none, retain: { paths: ['/a', '/b'], on: 'failure', ttl_s: 600 } }, NOW)).toBe(
      'Keeps 2 paths if it fails, for 10m 0s',
    );
  });

  it('counts the files kept, their size and until when, and what was not kept', () => {
    const ended: Kept = {
      ended_at: '2026-11-26T10:00:00Z',
      retain: { paths: ['/workspace/output.json', '/workspace/out/', '/workspace/t.jsonl'], on: 'any', ttl_s: 86400 },
      retained: [
        { path: '/workspace/output.json', size: 812 },
        { path: '/workspace/out/a.txt', size: 2 },
      ],
      not_retained: [{ path: '/workspace/t.jsonl', reason: 'it does not exist in the sandbox' }],
      retained_until: '2026-11-27T10:00:00Z',
    };
    expect(keptFiles(ended, NOW)).toMatch(
      /^2 files, 814 B · until .+ · 1 path not kept: it does not exist in the sandbox$/,
    );
    expect(keptFiles(ended, Date.parse('2026-11-28T00:00:00Z'))).toMatch(/^2 files, 814 B · no longer kept, since /);
    expect(
      keptFiles(
        {
          ...ended,
          retained: [],
          not_retained: [
            { path: '/a', reason: 'over 64 MiB' },
            { path: '/b', reason: 'it does not exist in the sandbox' },
          ],
        },
        NOW,
      ),
    ).toBe('Nothing kept · 2 paths not kept');
  });
});
