import { describe, expect, it } from 'vitest';

import { EXIT_KIND_LABEL, exitReasonInfo, exitReasonSentence, memoryKind } from './exitReasons';
import type { ExitKind } from './types';

describe('an ending, by its kind', () => {
  it('names every kind in plain words', () => {
    const kinds: ExitKind[] = [
      'main_exited',
      'timeout',
      'idle_timeout',
      'oom',
      'memory_reclaimed',
      'disk_limit',
      'insufficient_balance',
      'terminated',
      'failed',
      'lost',
    ];
    for (const k of kinds) expect(EXIT_KIND_LABEL[k]).toMatch(/^[A-Z][a-z ]+$/);
  });

  it('says how the main process exited, with its code', () => {
    expect(exitReasonInfo('exited with code 2', { exit_kind: 'main_exited', exit_code: 2 })).toEqual({
      label: 'Exited with code 2',
      detail: 'Its main process ended, which ends the sandbox.',
      action: 'Its logs say why.',
    });
    expect(exitReasonInfo('exited with code 0', { exit_kind: 'main_exited', exit_code: 0 }).action).toBeUndefined();
  });

  it('says how long a timeout and an idle timeout were', () => {
    expect(exitReasonInfo('timeout (300s)', { exit_kind: 'timeout' })).toEqual({
      label: 'Timed out',
      detail: 'It ran for its whole timeout of 5 min.',
      action: 'Give it a longer timeout, or none.',
    });
    expect(exitReasonInfo('idle_timeout (60s)', { exit_kind: 'idle_timeout' }).detail).toBe(
      'Nothing ran in it (no command and no file call) for 1 min.',
    );
  });

  it('tells its own disk from its node’s', () => {
    expect(exitReasonInfo('disk_limit (512 MiB)', { exit_kind: 'disk_limit', resources: { disk: 512 } })).toEqual({
      label: 'Disk full',
      detail: 'It wrote past its disk of 512 MiB.',
      action: 'Give it more disk.',
    });
    expect(exitReasonInfo('disk_limit (node disk is low)', { exit_kind: 'disk_limit' }).action).toBeUndefined();
  });

  it('keeps the reason a terminate gave, and the stage a failed start names', () => {
    expect(exitReasonInfo('terminated by API: done', { exit_kind: 'terminated' }).detail).toBe(
      'Through the API: done.',
    );
    expect(exitReasonInfo('terminated by API', { exit_kind: 'terminated' }).detail).toBe('Through the API.');
    expect(
      exitReasonSentence('failed: image pull ghcr.io/acme/agent:1.4: the registry refused the credential', {
        exit_kind: 'failed',
      }),
    ).toBe('Failed to start: Image pull ghcr.io/acme/agent:1.4: the registry refused the credential.');
  });

  it('says what was lost', () => {
    expect(exitReasonInfo('lost: host restarted', { exit_kind: 'lost' })).toEqual({
      label: 'Lost',
      detail: 'Its node’s host restarted while it ran.',
    });
  });

  it('reads the memory endings by kind, with the numbers of the sandbox', () => {
    const sb = { exit_kind: 'oom' as const, resources: { memory: 256, memory_limit: 1024 } };
    expect(exitReasonInfo('oom_killed', sb).detail).toBe('It reached its memory limit of 1 GiB and was stopped.');
    expect(memoryKind('oom')).toBe(true);
    expect(memoryKind('memory_reclaimed')).toBe(true);
    expect(memoryKind('timeout')).toBe(false);
    expect(memoryKind(null)).toBe(false);
  });

  it('leaves a usage record’s reason as the node wrote it unless it needs words', () => {
    expect(exitReasonInfo('timeout (600s)')).toEqual({ label: 'timeout (600s)' });
    expect(exitReasonInfo('insufficient_balance').label).toBe('Out of balance');
  });
});
