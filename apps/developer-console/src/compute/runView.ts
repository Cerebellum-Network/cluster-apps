/**
 * What an agent run did, as rows for the run page: from the live event stream
 * (the runner's JSON lines) or, afterwards, from its /workspace/transcript.jsonl:
 * one `{ts, kind, data}` per Claude Agent SDK message (the agent runner), or one
 * `{ts, node, message}` per LangGraph message (the LangGraph example image).
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
        else
          items.push({
            kind: 'tool',
            id: e.id,
            tool: 'tool',
            input: '',
            status: e.is_error ? 'error' : 'ok',
            output: e.output,
          });
        break;
      }
      case 'denied': {
        const i = e.id ? tools.get(e.id) : undefined;
        const row = i !== undefined ? items[i] : undefined;
        if (row?.kind === 'tool') items[i!] = { ...row, status: 'denied', output: e.reason };
        else
          items.push({
            kind: 'tool',
            id: e.id || `denied-${++anon}`,
            tool: e.tool,
            input: summariseInput(e.input),
            status: 'denied',
            output: e.reason,
          });
        break;
      }
      default:
        break;
    }
  }
  return items;
}

type Block = {
  _type?: string;
  text?: unknown;
  id?: unknown;
  name?: unknown;
  input?: unknown;
  tool_use_id?: unknown;
  content?: unknown;
  is_error?: unknown;
};

const contentText = (c: unknown): string => {
  if (typeof c === 'string') return c;
  if (Array.isArray(c))
    return c
      .map((p) =>
        p && typeof p === 'object' && typeof (p as { text?: unknown }).text === 'string'
          ? (p as { text: string }).text
          : '',
      )
      .join('\n');
  return c == null ? '' : JSON.stringify(c);
};

/** A LangChain message as LangGraph's `model_dump()` writes it. */
type LangChainMessage = {
  type?: unknown;
  content?: unknown;
  tool_calls?: unknown;
  tool_call_id?: unknown;
  name?: unknown;
  status?: unknown;
};

/** Text of a LangChain message's content: a string, or the `text` blocks of a list. */
const langChainText = (c: unknown): string => {
  if (typeof c === 'string') return c;
  if (!Array.isArray(c)) return '';
  return c
    .map((b) =>
      b && typeof b === 'object' && (b as { type?: unknown }).type === 'text'
        ? String((b as { text?: unknown }).text ?? '')
        : '',
    )
    .join('');
};

const RAW_MAX = 500;

/**
 * transcript.jsonl → rows. Two shapes are read:
 *   - the agent runner's `{ts, kind, data}`: `input`, then the SDK's
 *     AssistantMessage (text and tool-use blocks), UserMessage (tool results),
 *     ResultMessage, and `error`; other kinds (system messages) are skipped;
 *   - LangGraph's `{ts, node, message}`: an `ai` message (text and
 *     `tool_calls`) from the agent node, a `tool` message (its result, by
 *     `tool_call_id`) from the tools node.
 * A line of any other shape is shown as is (shortened), as is one that isn't
 * JSON, so a container's own transcript never reads as "nothing recorded".
 */
export function transcriptItems(jsonl: string): {
  items: RunItem[];
  prompt: string | null;
  result: Record<string, unknown> | null;
} {
  const items: RunItem[] = [];
  const tools = new Map<string, number>();
  let prompt: string | null = null;
  let result: Record<string, unknown> | null = null;
  const pushTool = (id: string, tool: string, input: unknown) => {
    tools.set(id, items.length);
    items.push({ kind: 'tool', id, tool, input: summariseInput(input), status: 'running' });
  };
  const settleTool = (id: string, status: ToolStatus, output: string) => {
    const i = tools.get(id);
    const row = i !== undefined ? items[i] : undefined;
    if (row?.kind === 'tool') items[i!] = { ...row, status, output };
    else items.push({ kind: 'tool', id, tool: 'tool', input: '', status, output });
  };
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue;
    let rec: { kind?: string; data?: Record<string, unknown>; node?: unknown; message?: LangChainMessage };
    try {
      rec = JSON.parse(line);
    } catch {
      items.push({ kind: 'log', text: line });
      continue;
    }
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) {
      items.push({ kind: 'log', text: line.length > RAW_MAX ? `${line.slice(0, RAW_MAX)}…` : line });
      continue;
    }
    if (rec.kind === undefined && rec.message && typeof rec.message === 'object') {
      // LangGraph: {ts, node, message}.
      const m = rec.message;
      if (m.type === 'ai') {
        const t = langChainText(m.content);
        if (t.trim()) items.push({ kind: 'text', text: t });
        for (const tc of Array.isArray(m.tool_calls) ? m.tool_calls : []) {
          const c = (tc ?? {}) as { id?: unknown; name?: unknown; args?: unknown };
          pushTool(String(c.id ?? `t${items.length}`), String(c.name ?? 'tool'), c.args);
        }
      } else if (m.type === 'tool') {
        const out = langChainText(m.content) || (typeof m.content === 'string' ? m.content : JSON.stringify(m.content));
        settleTool(String(m.tool_call_id ?? ''), m.status === 'error' ? 'error' : 'ok', out);
      }
      continue;
    }
    if (rec.kind === undefined) {
      items.push({ kind: 'log', text: line.length > RAW_MAX ? `${line.slice(0, RAW_MAX)}…` : line });
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
          else if (typeof b.name === 'string') pushTool(String(b.id ?? `t${items.length}`), b.name, b.input);
        }
        break;
      case 'UserMessage':
        for (const b of (Array.isArray(data.content) ? data.content : []) as Block[]) {
          if (b.tool_use_id === undefined) continue;
          settleTool(String(b.tool_use_id), b.is_error ? 'error' : 'ok', contentText(b.content));
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
