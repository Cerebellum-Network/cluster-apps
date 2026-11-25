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

  // The shape of the LangGraph example's transcript (a real run's lines, trimmed).
  it('reads the LangGraph example’s {ts, node, message} lines', () => {
    const lines = [
      { ts: 1, kind: 'input', data: { prompt: 'Latest requests release?' } },
      {
        ts: 2,
        node: 'agent',
        message: {
          content: [{ signature: '', thinking: 'Look it up.', type: 'thinking' }],
          type: 'ai',
          tool_calls: [{ name: 'pypi_latest', args: { package: 'requests' }, id: 'call_1', type: 'tool_call' }],
          usage_metadata: { input_tokens: 271, output_tokens: 124 },
        },
      },
      {
        ts: 3,
        node: 'tools',
        message: {
          content: '{"package": "requests", "version": "2.34.2"}',
          type: 'tool',
          name: 'pypi_latest',
          tool_call_id: 'call_1',
          status: 'success',
        },
      },
      {
        ts: 4,
        node: 'agent',
        message: {
          content: [{ type: 'thinking', thinking: 'Now the age.' }],
          type: 'ai',
          tool_calls: [{ name: 'days_since', args: { timestamp: '2026-05-14T19:25:26Z' }, id: 'call_2' }],
        },
      },
      { ts: 5, node: 'tools', message: { content: 'boom', type: 'tool', tool_call_id: 'call_2', status: 'error' } },
      { ts: 6, node: 'agent', message: { content: 'requests 2.34.2, 194 days ago.', type: 'ai', tool_calls: [] } },
    ]
      .map((l) => JSON.stringify(l))
      .join('\n');
    const t = transcriptItems(lines);
    expect(t.prompt).toBe('Latest requests release?');
    expect(t.items).toEqual([
      {
        kind: 'tool',
        id: 'call_1',
        tool: 'pypi_latest',
        input: '{"package":"requests"}',
        status: 'ok',
        output: '{"package": "requests", "version": "2.34.2"}',
      },
      {
        kind: 'tool',
        id: 'call_2',
        tool: 'days_since',
        input: '{"timestamp":"2026-05-14T19:25:26Z"}',
        status: 'error',
        output: 'boom',
      },
      { kind: 'text', text: 'requests 2.34.2, 194 days ago.' },
    ]);
  });

  it('shows a line of an unknown shape as it is, instead of nothing', () => {
    const t = transcriptItems('{"step":1,"thought":"x"}\n[1,2]\n');
    expect(t.items).toEqual([
      { kind: 'log', text: '{"step":1,"thought":"x"}' },
      { kind: 'log', text: '[1,2]' },
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
