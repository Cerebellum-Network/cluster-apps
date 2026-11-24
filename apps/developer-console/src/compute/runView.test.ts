import { describe, expect, it } from 'vitest';

import type { RunEvent } from './agentRun';
import { foldEvents, summariseInput, transcriptItems } from './runView';

describe('foldEvents', () => {
  it('pairs a tool call with its result and a refusal, and keeps text and logs', () => {
    const events: RunEvent[] = [
      { event: 'log', message: 'agent sre: harness claude-code' },
      { event: 'text', text: 'Looking at CI.' },
      { event: 'tool_call', tool: 'Bash', input: { command: 'gh run list' }, id: 't1' },
      { event: 'tool_call', tool: 'Bash', input: { command: 'gh pr merge 1' }, id: 't2' },
      { event: 'tool_result', id: 't1', output: 'ok', is_error: false },
      { event: 'denied', tool: 'Bash', input: { command: 'gh pr merge 1' }, reason: 'read-only policy', id: 't2' },
      { event: 'raw', stream: 'stderr', text: 'warning' },
      { event: 'done', turns: 2, tool_calls: 2, error: null, model_usage: {} },
    ];
    expect(foldEvents(events)).toEqual([
      { kind: 'log', text: 'agent sre: harness claude-code', stream: undefined },
      { kind: 'text', text: 'Looking at CI.' },
      { kind: 'tool', id: 't1', tool: 'Bash', input: 'gh run list', status: 'ok', output: 'ok' },
      { kind: 'tool', id: 't2', tool: 'Bash', input: 'gh pr merge 1', status: 'denied', output: 'read-only policy' },
      { kind: 'log', text: 'warning', stream: 'stderr' },
    ]);
  });
});

describe('transcriptItems', () => {
  it('reads the SDK messages the runner records', () => {
    const lines = [
      { ts: 1, kind: 'input', data: { prompt: 'status?', agent: 'sre' } },
      { ts: 2, kind: 'SystemMessage', data: { subtype: 'init' } },
      {
        ts: 3,
        kind: 'AssistantMessage',
        data: {
          content: [
            { text: 'Checking.', _type: 'TextBlock' },
            { id: 'tu1', name: 'WebFetch', input: { url: 'https://gvisor.dev/docs/' }, _type: 'ToolUseBlock' },
          ],
        },
      },
      {
        ts: 4,
        kind: 'UserMessage',
        data: { content: [{ tool_use_id: 'tu1', content: [{ type: 'text', text: 'gVisor is…' }], is_error: false }] },
      },
      { ts: 5, kind: 'ResultMessage', data: { subtype: 'success', num_turns: 2, result: 'done' } },
    ]
      .map((l) => JSON.stringify(l))
      .join('\n');
    const t = transcriptItems(`${lines}\nnot json\n`);
    expect(t.prompt).toBe('status?');
    expect(t.result).toMatchObject({ num_turns: 2 });
    expect(t.items).toEqual([
      { kind: 'text', text: 'Checking.' },
      {
        kind: 'tool',
        id: 'tu1',
        tool: 'WebFetch',
        input: 'https://gvisor.dev/docs/',
        status: 'ok',
        output: 'gVisor is…',
      },
      { kind: 'log', text: 'not json' },
    ]);
  });
});

describe('summariseInput', () => {
  it('picks the command, url or path, else compact JSON', () => {
    expect(summariseInput({ command: 'ls -la', description: 'list' })).toBe('ls -la');
    expect(summariseInput({ url: 'https://example.org', prompt: 'x' })).toBe('https://example.org');
    expect(summariseInput({ file_path: '/workspace/a.md' })).toBe('/workspace/a.md');
    expect(summariseInput({ a: 1 })).toBe('{"a":1}');
  });
});
