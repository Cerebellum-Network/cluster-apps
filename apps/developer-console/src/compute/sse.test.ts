import { describe, expect, it } from 'vitest';

import { parseData, readSse, SseParser, type SseMessage } from './sse';

const collect = (chunks: string[]) => {
  const out: SseMessage[] = [];
  const p = new SseParser((m) => out.push(m));
  for (const c of chunks) p.push(c);
  p.end();
  return out;
};

describe('SseParser', () => {
  it('parses named events and joins multi-line data', () => {
    expect(
      collect(['event: stdout\ndata: {"data":"hi\\n"}\n\n', 'event: exit\ndata: line 1\ndata: line 2\n\n']),
    ).toEqual([
      { event: 'stdout', data: '{"data":"hi\\n"}' },
      { event: 'exit', data: 'line 1\nline 2' },
    ]);
  });

  it('handles events split across chunks, CRLF and the gateway ping comment', () => {
    expect(collect([': ping\r\n\r\nevent: std', 'out\r\ndata: {"data"', ':"x"}\r', '\n\r\n'])).toEqual([
      { event: 'stdout', data: '{"data":"x"}' },
    ]);
  });

  it('defaults the event name to message and flushes a trailing event', () => {
    expect(collect(['data: x'])).toEqual([{ event: 'message', data: 'x' }]);
  });

  it('reads a fetch body stream', async () => {
    const enc = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(enc.encode('event: stdout\ndata: {"data":"a"}\n\nevent: ex'));
        c.enqueue(enc.encode('it\ndata: {"exit_code":0}\n\n'));
        c.close();
      },
    });
    const out: SseMessage[] = [];
    await readSse(body, (m) => out.push(m));
    expect(out.map((m) => m.event)).toEqual(['stdout', 'exit']);
  });
});

describe('parseData', () => {
  it('parses JSON and leaves text alone', () => {
    expect(parseData('{"exit_code":0}')).toEqual({ exit_code: 0 });
    expect(parseData('hello world')).toBe('hello world');
    expect(parseData('{not json')).toBe('{not json');
  });
});
