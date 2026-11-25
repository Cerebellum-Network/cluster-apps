import { describe, expect, it } from 'vitest';

import { endedBadly } from './types';

describe('endedBadly', () => {
  it('counts a failed start, an OOM kill, a lost sandbox and a non-zero exit as failures', () => {
    expect(endedBadly({ status: 'failed', exit_reason: 'failed: image pull not found' })).toBe(true);
    expect(endedBadly({ status: 'terminated', exit_reason: 'oom_killed' })).toBe(true);
    expect(endedBadly({ status: 'terminated', exit_reason: 'lost: runtime restarted' })).toBe(true);
    expect(endedBadly({ status: 'terminated', exit_reason: 'exited with code 2' })).toBe(true);
  });

  it('counts a terminate, a time limit, an idle limit and a clean exit as finished', () => {
    expect(endedBadly({ status: 'terminated', exit_reason: 'terminated by API: done' })).toBe(false);
    expect(endedBadly({ status: 'terminated', exit_reason: 'timeout (30s)' })).toBe(false);
    expect(endedBadly({ status: 'terminated', exit_reason: 'idle_timeout (20s)' })).toBe(false);
    expect(endedBadly({ status: 'terminated', exit_reason: 'exited with code 0' })).toBe(false);
    expect(endedBadly({ status: 'running', exit_reason: null })).toBe(false);
  });
});
