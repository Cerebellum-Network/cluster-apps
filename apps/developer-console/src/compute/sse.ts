/**
 * A minimal `text/event-stream` parser for fetch bodies. `EventSource` can't
 * send an `Authorization` header, and the compute API never takes credentials
 * in a query string, so the console reads SSE through `fetch`.
 *
 * Per the SSE spec: events are separated by a blank line; `event:` names the
 * event (default `message`), `data:` lines join with "\n", lines starting with
 * `:` are comments (the gateway's `: ping` every 15 s), and a single space after
 * the colon is dropped.
 */
export type SseMessage = { event: string; data: string; id?: string };

export class SseParser {
  private buffer = '';
  private event = '';
  private data: string[] = [];
  private id: string | undefined;

  constructor(private readonly onMessage: (m: SseMessage) => void) {}

  /** Feed a decoded chunk; emits every complete event in it. */
  push(chunk: string): void {
    this.buffer += chunk;
    let nl: number;
    while ((nl = this.nextLineEnd()) >= 0) {
      let line = this.buffer.slice(0, nl);
      // Consume "\r\n" as one line end.
      const skip = this.buffer[nl] === '\r' && this.buffer[nl + 1] === '\n' ? 2 : 1;
      this.buffer = this.buffer.slice(nl + skip);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      this.line(line);
    }
  }

  /** Flush a trailing event that wasn't followed by a blank line. */
  end(): void {
    if (this.buffer) {
      this.line(this.buffer);
      this.buffer = '';
    }
    this.dispatch();
  }

  private nextLineEnd(): number {
    const n = this.buffer.indexOf('\n');
    const r = this.buffer.indexOf('\r');
    if (r >= 0 && (n < 0 || r < n)) {
      // A lone "\r" at the very end may be the first half of "\r\n": wait for more.
      if (r === this.buffer.length - 1) return n;
      return r;
    }
    return n;
  }

  private line(line: string): void {
    if (line === '') {
      this.dispatch();
      return;
    }
    if (line.startsWith(':')) return;
    const colon = line.indexOf(':');
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') this.event = value;
    else if (field === 'data') this.data.push(value);
    else if (field === 'id') this.id = value;
  }

  private dispatch(): void {
    if (this.data.length === 0 && !this.event) return;
    const message: SseMessage = { event: this.event || 'message', data: this.data.join('\n') };
    if (this.id !== undefined) message.id = this.id;
    this.event = '';
    this.data = [];
    this.onMessage(message);
  }
}

/** The event's `data` as JSON (every `data:` line on the compute API is JSON); the raw string when it isn't. */
export function parseData(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

/** Read an SSE response body to the end (or until `signal` aborts), calling `onMessage` per event. */
export async function readSse(
  body: ReadableStream<Uint8Array>,
  onMessage: (m: SseMessage) => void,
  signal?: AbortSignal,
): Promise<void> {
  const parser = new SseParser(onMessage);
  const reader = body.getReader();
  const decoder = new TextDecoder();
  try {
    for (;;) {
      if (signal?.aborted) return;
      const { value, done } = await reader.read();
      if (done) break;
      parser.push(decoder.decode(value, { stream: true }));
    }
    parser.push(decoder.decode());
    parser.end();
  } finally {
    reader.releaseLock();
  }
}
