import { describe, expect, it } from 'vitest';

import { endedBadly, parseHosts, SECRET_HOST_RE } from './types';

describe('endedBadly', () => {
  it('counts a failed start, an OOM kill, a lost sandbox and a non-zero exit as failures', () => {
    expect(endedBadly({ status: 'failed', exit_reason: 'failed: image pull not found' })).toBe(true);
    expect(endedBadly({ status: 'terminated', exit_reason: 'oom_killed' })).toBe(true);
    expect(endedBadly({ status: 'terminated', exit_reason: 'memory_reclaimed' })).toBe(true);
    expect(endedBadly({ status: 'terminated', exit_reason: 'lost: runtime restarted' })).toBe(true);
    expect(endedBadly({ status: 'terminated', exit_reason: 'exited with code 2' })).toBe(true);
  });

  it('counts a terminate, a time limit, an idle limit, a token expiry and a clean exit as finished', () => {
    expect(endedBadly({ status: 'terminated', exit_reason: 'terminated by API: done' })).toBe(false);
    expect(endedBadly({ status: 'terminated', exit_reason: 'timeout (30s)' })).toBe(false);
    expect(endedBadly({ status: 'terminated', exit_reason: 'idle_timeout (20s)' })).toBe(false);
    expect(endedBadly({ status: 'terminated', exit_reason: 'token_expiry' })).toBe(false);
    expect(endedBadly({ status: 'terminated', exit_reason: 'exited with code 0' })).toBe(false);
    expect(endedBadly({ status: 'running', exit_reason: null })).toBe(false);
  });
});

describe('secret hosts', () => {
  it('splits what a person typed into hosts', () => {
    expect(parseHosts(' API.GitHub.com, api.github.com  *.example.com\nuploads.github.com. ')).toEqual([
      'api.github.com',
      '*.example.com',
      'uploads.github.com',
    ]);
    expect(parseHosts('')).toEqual([]);
  });

  it('accepts host names and one-label wildcards, not URLs', () => {
    for (const h of ['api.github.com', '*.example.com', 'inference-gateway.compute.dev.ddcdragon.com']) {
      expect(SECRET_HOST_RE.test(h)).toBe(true);
    }
    for (const h of ['https://api.github.com', 'api.github.com/x', '*', '*.com', 'localhost', 'a b.com', 'a.*.com']) {
      expect(SECRET_HOST_RE.test(h)).toBe(false);
    }
  });
});
