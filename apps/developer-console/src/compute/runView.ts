/**
 * What an agent run did, as rows for the run page: from the live event stream
 * (the runner's JSON lines) or, afterwards, from its /workspace/transcript.jsonl
 * (one `{ts, kind, data}` per Claude Agent SDK message).
 */
import type { RunEvent } from './agentRun';

export type ToolStatus = 'running' | 'ok' | 'error' | 'denied';

export type RunItem =
  | { kind: 'log'; text: string; stream?: 'stdout' | 'stderr' }
  | { kind: 'text'; text: string }
  | { kind: 'tool'; id: string; tool: string; input: string; status: ToolStatus; output?: string };

/** A tool's input as one line: the command, URL, path or pattern; else compact JSON. */
export function summariseInput(input: unknown): string {
  if (typeof input === 'string') return input;
  if (!input || typeof input !== 'object') return input === undefined ? '' : String(input);
  const o = input as Record<string, unknown>;
  for (const k of ['command', 'url', 'file_path', 'path', 'pattern', 'query', 'prompt']) {
    if (typeof o[k] === 'string' && o[k]) return o[k] as string;
  }
  const s = JSON.stringify(o);
  return s.length > 200 ? `${s.slice(0, 197)}…` : s;
}

/** Fold the live events into rows: a tool call and its result (or refusal) become one row. */
export function foldEvents(events: RunEvent[]): RunItem[] {
  const items: RunItem[] = [];
  const tools = new Map<string, number>();
  let anon = 0;
  for (const e of events) {
    switch (e.event) {
      case 'log':
        items.push({ kind: 'log', text: e.message, stream: e.stream === 'cli-stderr' ? 'stderr' : undefined });
        break;
      case 'raw':
        if (e.text.trim()) items.push({ kind: 'log', text: e.text, stream: e.stream });
        break;
      case 'text':
        if (e.text.trim()) items.push({ kind: 'text', text: e.text });
        break;
      case 'tool_call': {
        const id = e.id || `call-${++anon}`;
        tools.set(id, items.length);
        items.push({ kind: 'tool', id, tool: e.tool, input: summariseInput(e.input), status: 'running' });
        break;
      }
      case 'tool_result': {
        const i = tools.get(e.id);
        const row = i !== undefined ? items[i] : undefined;
        if (row?.kind === 'tool') items[i!] = { ...row, status: e.is_error ? 'error' : 'ok', output: e.output };
        else items.push({ kind: 'tool', id: e.id, tool: 'tool', input: '', status: e.is_error ? 'error' : 'ok', output: e.output });
        break;
      }
      case 'denied': {
        const i = e.id ? tools.get(e.id) : undefined;
        const row = i !== undefined ? items[i] : undefined;
        if (row?.kind === 'tool') items[i!] = { ...row, status: 'denied', output: e.reason };
        else items.push({ kind: 'tool', id: e.id || `denied-${++anon}`, tool: e.tool, input: summariseInput(e.input), status: 'denied', output: e.reason });
        break;
      }
      default:
        break;
    }
  }
  return items;
}

type Block = { _type?: string; text?: unknown; id?: unknown; name?: unknown; input?: unknown; tool_use_id?: unknown; content?: unknown; is_error?: unknown };

const contentText = (c: unknown): string => {
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map((p) => (p && typeof p === 'object' && typeof (p as { text?: unknown }).text === 'string' ? (p as { text: string }).text : '')).join('\n');
  return c == null ? '' : JSON.stringify(c);
};

/**
 * transcript.jsonl → rows. Each line is `{ts, kind, data}`: `input`, then the
 * SDK's AssistantMessage (text and tool-use blocks), UserMessage (tool
 * results), ResultMessage, and `error`. Lines it doesn't know are skipped;
 * a line that isn't JSON is shown as is.
 */
export function transcriptItems(jsonl: string): { items: RunItem[]; prompt: string | null; result: Record<string, unknown> | null } {
  const items: RunItem[] = [];
  const tools = new Map<string, number>();
  let prompt: string | null = null;
  let result: Record<string, unknown> | null = null;
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue;
    let rec: { kind?: string; data?: Record<string, unknown> };
    try {
      rec = JSON.parse(line);
    } catch {
      items.push({ kind: 'log', text: line });
      continue;
    }
    const data = rec.data ?? {};
    switch (rec.kind) {
      case 'input':
        prompt = typeof data.prompt === 'string' ? data.prompt : null;
        break;
      case 'AssistantMessage':
        for (const b of (Array.isArray(data.content) ? data.content : []) as Block[]) {
          if (typeof b.text === 'string' && b.text.trim()) items.push({ kind: 'text', text: b.text });
          else if (typeof b.name === 'string') {
            const id = String(b.id ?? `t${items.length}`);
            tools.set(id, items.length);
            items.push({ kind: 'tool', id, tool: b.name, input: summariseInput(b.input), status: 'running' });
          }
        }
        break;
      case 'UserMessage':
        for (const b of (Array.isArray(data.content) ? data.content : []) as Block[]) {
          if (b.tool_use_id === undefined) continue;
          const id = String(b.tool_use_id);
          const i = tools.get(id);
          const out = contentText(b.content);
          const status: ToolStatus = b.is_error ? 'error' : 'ok';
          const row = i !== undefined ? items[i] : undefined;
          if (row?.kind === 'tool') items[i!] = { ...row, status, output: out };
          else items.push({ kind: 'tool', id, tool: 'tool', input: '', status, output: out });
        }
        break;
      case 'ResultMessage':
        result = data;
        break;
      case 'error':
        items.push({ kind: 'log', text: String(data.error ?? JSON.stringify(data)), stream: 'stderr' });
        break;
      default:
        break;
    }
  }
  return { items, prompt, result };
}
