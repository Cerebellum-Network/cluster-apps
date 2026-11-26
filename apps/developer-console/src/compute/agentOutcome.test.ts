import { describe, expect, it } from 'vitest';

import { fitBytes, MAX_REASON_BYTES, outcomeOf, terminateReason, withoutFiles, type RunOutcome } from './agentOutcome';
import type { SandboxStatus } from './types';

const bytes = (s: string) => new TextEncoder().encode(s).length;
const sb = (status: SandboxStatus, exit_reason: string | null = null) => ({ status, exit_reason });

describe('terminateReason', () => {
  it('records succeeded, failed with the error, or stopped', () => {
    expect(terminateReason({ stopped: false, error: null })).toBe('agent run succeeded');
    expect(terminateReason({ stopped: false, error: 'The run hit its 300 s limit.' })).toBe(
      'agent run failed: The run hit its 300 s limit.',
    );
    expect(terminateReason({ stopped: true, error: 'Stopped.' })).toBe('agent run stopped');
    expect(terminateReason({ stopped: false, error: 'line one\n  line two' })).toBe(
      'agent run failed: line one line two',
    );
  });

  it('fits the gateway’s 120-byte limit, cutting on a character', () => {
    const r = terminateReason({ stopped: false, error: 'ошибка '.repeat(40) });
    expect(bytes(r)).toBeLessThanOrEqual(MAX_REASON_BYTES);
    expect(r.endsWith('...')).toBe(true);
    expect(r).not.toContain('�');
    const kept = withoutFiles(r);
    expect(bytes(kept)).toBeLessThanOrEqual(MAX_REASON_BYTES);
    expect(kept.endsWith(' (files not retained)')).toBe(true);
    expect(fitBytes('short', 10)).toBe('short');
  });
});

describe('outcomeOf', () => {
  const cases: [ReturnType<typeof sb>, RunOutcome][] = [
    [sb('running'), { state: 'running' }],
    [sb('starting'), { state: 'running' }],
    [sb('unknown'), { state: 'unknown', detail: 'The sandbox’s node has not reported for a while.' }],
    [sb('failed', 'failed: image pull x'), { state: 'failed', detail: 'failed: image pull x' }],
    [sb('terminated', 'terminated by API: agent run succeeded'), { state: 'succeeded' }],
    [sb('terminated', 'terminated by API: agent run succeeded (files not retained)'), { state: 'succeeded' }],
    [
      sb('terminated', 'terminated by API: agent run failed: the agent did not finish within 300 s'),
      { state: 'failed', detail: 'the agent did not finish within 300 s' },
    ],
    [sb('terminated', 'terminated by API: agent run stopped'), { state: 'stopped', detail: 'Stopped by its client.' }],
    [
      sb('terminated', 'oom_killed'),
      {
        state: 'failed',
        detail:
          'The sandbox ended: out of memory. It reached its memory limit and was stopped. Raise the memory limit.',
      },
    ],
    [
      sb('terminated', 'memory_reclaimed'),
      {
        state: 'failed',
        detail:
          'The sandbox ended: memory reclaimed. It used more memory than its request while its node was short of memory, so the node stopped it to free memory. Raise the memory request to what it uses: memory within the request is never reclaimed.',
      },
    ],
    [sb('terminated', 'lost: host restarted'), { state: 'failed', detail: 'The sandbox ended: lost: host restarted' }],
    [sb('terminated', 'timeout (1020s)'), { state: 'ended', detail: 'timeout (1020s)' }],
    [
      sb('terminated', 'terminated by API: console terminate'),
      { state: 'ended', detail: 'terminated by API: console terminate' },
    ],
  ];
  it.each(cases)('%o', (s, want) => expect(outcomeOf(s)).toEqual(want));
});
