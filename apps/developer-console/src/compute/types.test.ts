import { describe, expect, it } from 'vitest';

import { endedBadly, parseHosts, SECRET_HOST_RE, type ExitKind, type SandboxStatus } from './types';

describe('endedBadly', () => {
  const ended = (exit_kind: ExitKind, exit_code: number | null = null, status: SandboxStatus = 'terminated') => ({
    status,
    exit_kind,
    exit_code,
  });

  it('counts a failed start, an OOM kill, reclaimed memory, a lost sandbox and a non-zero exit as failures', () => {
    expect(endedBadly(ended('failed', null, 'failed'))).toBe(true);
    expect(endedBadly(ended('oom', 137))).toBe(true);
    expect(endedBadly(ended('memory_reclaimed', 137))).toBe(true);
    expect(endedBadly(ended('lost'))).toBe(true);
    expect(endedBadly(ended('main_exited', 2))).toBe(true);
  });

  it('counts a terminate, a time limit, an idle limit, a full disk, running out of balance and a clean exit as finished', () => {
    expect(endedBadly(ended('terminated', 137))).toBe(false);
    expect(endedBadly(ended('timeout', 137))).toBe(false);
    expect(endedBadly(ended('idle_timeout', 137))).toBe(false);
    expect(endedBadly(ended('disk_limit', 137))).toBe(false);
    expect(endedBadly(ended('insufficient_balance', 137))).toBe(false);
    expect(endedBadly(ended('insufficient_balance', null, 'failed'))).toBe(false);
    expect(endedBadly(ended('main_exited', 0))).toBe(false);
    expect(endedBadly({ status: 'running', exit_kind: null, exit_code: null })).toBe(false);
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
