/**
 * The compute gateway's public API (`/v1`), as the build design's contract
 * (Section 3.2) defines it. One method per route; JSON in and out; the
 * COMPUTE token as `Authorization: Bearer`; SSE read through `fetch` so the
 * token stays in a header, never in a query string.
 *
 * Errors come back in the gateway's native envelope `{"error": "...", "code":
 * "..."}` with the status carrying the class; they surface as ComputeError.
 */
import { computeConfig } from './computeConfig';
import { parseData, readSse } from './sse';
import { EMPTY_USAGE } from './types';
import type {
  CreateSandboxRequest,
  EgressDecision,
  EgressEntry,
  EgressPolicy,
  ExecEvent,
  ExecExit,
  ExecRequest,
  ExecResult,
  LogEvent,
  Page,
  Sandbox,
  SandboxStatus,
  SecretInput,
  SecretSummary,
  Usage,
  UsageRecord,
} from './types';

export class ComputeError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** The handler's stable code (`no_capacity`, `not_running`, `file_gone`, …), when it sent one. */
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ComputeError';
  }
}

/**
 * The token itself was refused (absent, malformed, expired, badly signed):
 * minting a new one can help. A 403 is a credible token without the authority
 * (another bucket's sandbox, no balance), which a new token would not change.
 */
export const isTokenRejected = (e: unknown): boolean => e instanceof ComputeError && e.status === 401;

export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** The code of the API's 403 for a call that costs money (create, exec, file upload) when the bucket's owner has no balance. */
export const NO_BALANCE_CODE = 'insufficient_balance';

/** That refusal: the error itself, or the message a page kept of it ("bucket owner has insufficient balance"). */
export const isNoBalance = (e: unknown): boolean =>
  (e instanceof ComputeError && e.code === NO_BALANCE_CODE) || /insufficient balance/i.test(errorMessage(e ?? ''));

type Query = Record<string, string | number | string[] | undefined | null>;

export interface ListSandboxesQuery {
  status?: SandboxStatus;
  /** `key=value` pairs, ANDed (the API's label filter). */
  label?: string[];
  limit?: number;
  cursor?: string;
}

export interface EgressLogQuery {
  sandbox_id?: string;
  since?: string;
  until?: string;
  decision?: EgressDecision;
  limit?: number;
  cursor?: string;
}

export interface UsageRecordsQuery {
  sandbox_id?: string;
  since?: string;
  limit?: number;
  cursor?: string;
}

/** Which secret a secrets call means: the bucket's (no `agent`), or that agent's. */
export interface SecretScope {
  agent?: string;
  signal?: AbortSignal;
}

export interface TerminateOptions {
  /** Absolute paths kept after termination (each ≤ 16 MiB). */
  retain?: string[];
  /** ≤ 120 characters; recorded as `terminated by API: <reason>`. */
  reason?: string;
}

export interface ComputeClient {
  readonly baseUrl: string;
  listSandboxes(q?: ListSandboxesQuery, signal?: AbortSignal): Promise<Page<Sandbox>>;
  getSandbox(id: string, signal?: AbortSignal): Promise<Sandbox>;
  createSandbox(req: CreateSandboxRequest, signal?: AbortSignal): Promise<Sandbox>;
  terminate(id: string, opts?: TerminateOptions, signal?: AbortSignal): Promise<Sandbox>;
  /**
   * `PUT /v1/sandboxes/{id}/egress`: replace a running sandbox's allow-list. The egress proxy applies it from the next
   * request; the gateway checks the rules as at create (`invalid_egress`, `unknown_credential`,
   * `credential_not_bound`) and refuses an ended sandbox (409 `not_running`). Resolves with the sandbox as it is now.
   */
  setEgress(id: string, egress: EgressPolicy, signal?: AbortSignal): Promise<Sandbox>;
  exec(id: string, req: ExecRequest, signal?: AbortSignal): Promise<ExecResult>;
  /** Streams the command's output to `onEvent`; resolves with its exit once the stream says so. */
  execStream(id: string, req: ExecRequest, onEvent: (e: ExecEvent) => void, signal?: AbortSignal): Promise<ExecExit>;
  putFile(id: string, path: string, body: Blob | Uint8Array | string, signal?: AbortSignal): Promise<void>;
  getFile(id: string, path: string, signal?: AbortSignal): Promise<Blob>;
  /** The main process's output from the start; resolves when the gateway sends `end` or closes the stream. */
  logs(id: string, onEvent: (e: LogEvent) => void, signal?: AbortSignal): Promise<void>;
  usage(id: string, signal?: AbortSignal): Promise<Usage>;
  /** The bucket's secrets and its agents' (each of those with `agent`), never their values. */
  listSecrets(signal?: AbortSignal): Promise<SecretSummary[]>;
  /** `PUT /v1/secrets/{name}`, or with `agent` (`?agent=`) a secret only that agent's runs use. */
  putSecret(name: string, input: SecretInput, opts?: SecretScope): Promise<void>;
  deleteSecret(name: string, opts?: SecretScope): Promise<void>;
  /**
   * `PUT /v1/sandboxes/{id}/secrets/{name}`: a new value for one of a running sandbox's own secrets (header and
   * hosts stay as created), used from its next request. 404 `secret_not_found` for a name it was not created with,
   * 409 `not_running` once it has ended.
   */
  setSandboxSecret(id: string, name: string, value: string, signal?: AbortSignal): Promise<void>;
  egressLog(q?: EgressLogQuery, signal?: AbortSignal): Promise<Page<EgressEntry>>;
  usageRecords(q?: UsageRecordsQuery, signal?: AbortSignal): Promise<Page<UsageRecord>>;
}

/** Build `?a=1&b=x&b=y`, skipping empty values. Arrays repeat the key. */
export function queryString(q: Query | undefined): string {
  if (!q) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) v.filter(Boolean).forEach((x) => p.append(k, x));
    else p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

async function failure(res: Response): Promise<ComputeError> {
  const text = await res.text().catch(() => '');
  let message = text.slice(0, 500);
  let code: string | undefined;
  try {
    const body = JSON.parse(text) as { error?: unknown; code?: unknown; message?: unknown };
    if (typeof body.error === 'string') message = body.error;
    else if (typeof body.message === 'string') message = body.message;
    if (typeof body.code === 'string') code = body.code;
  } catch {
    /* not JSON: keep the text */
  }
  return new ComputeError(res.status, message || `${res.status} ${res.statusText}`.trim(), code);
}

/**
 * Lists the Go services send as `null` when empty (labels, env_keys, retained,
 * not_retained, egress.allow, command) become empty values, and usage gets every field, so
 * pages never meet a null where the contract has a list.
 */
export function normSandbox(sandbox: Sandbox): Sandbox {
  const { secrets, ...s } = sandbox;
  return {
    ...s,
    command: s.command ?? [],
    env_keys: s.env_keys ?? [],
    labels: s.labels ?? {},
    retained: s.retained ?? [],
    not_retained: s.not_retained ?? [],
    egress: { allow: s.egress?.allow ?? [] },
    ...(secrets ? { secrets: secrets.map((x) => ({ ...x, hosts: x.hosts ?? [] })) } : {}),
    usage: { ...EMPTY_USAGE, ...(s.usage ?? {}) },
  };
}

const page = <T>(body: unknown): Page<T> => {
  const b = (body ?? {}) as { items?: T[] | null; next_cursor?: string | null };
  return { items: Array.isArray(b.items) ? b.items : [], next_cursor: b.next_cursor || null };
};

export function createComputeClient(
  token: string,
  baseUrl: string = computeConfig.gatewayUrl,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): ComputeClient {
  const base = baseUrl.replace(/\/+$/, '');
  const auth = { Authorization: `Bearer ${token}` };
  const sb = (id: string) => `/v1/sandboxes/${encodeURIComponent(id)}`;

  async function send(
    method: string,
    path: string,
    init: { body?: BodyInit; json?: unknown; headers?: Record<string, string>; signal?: AbortSignal } = {},
  ): Promise<Response> {
    const headers: Record<string, string> = { ...auth, ...init.headers };
    let body = init.body;
    if (init.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(init.json);
    }
    const res = await fetchImpl(`${base}${path}`, { method, headers, body, cache: 'no-store', signal: init.signal });
    if (!res.ok) throw await failure(res);
    return res;
  }

  async function json<T>(method: string, path: string, init?: Parameters<typeof send>[2]): Promise<T> {
    const res = await send(method, path, init);
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  /** Open an SSE route and feed each event to `on`; resolves when the stream closes. */
  async function sse(
    method: 'GET' | 'POST',
    path: string,
    on: (event: string, data: unknown) => void,
    init: { json?: unknown; signal?: AbortSignal },
  ): Promise<void> {
    const res = await send(method, path, {
      json: init.json,
      signal: init.signal,
      headers: { Accept: 'text/event-stream' },
    });
    if (!res.body) throw new ComputeError(502, 'The API sent no stream.');
    await readSse(res.body, (m) => on(m.event, parseData(m.data)), init.signal);
  }

  const chunk = (d: unknown): string => {
    if (typeof d === 'string') return d;
    const v = (d as { data?: unknown } | null)?.data;
    return typeof v === 'string' ? v : '';
  };

  return {
    baseUrl: base,

    async listSandboxes(q, signal) {
      const p = page<Sandbox>(await json('GET', `/v1/sandboxes${queryString({ ...q, label: q?.label })}`, { signal }));
      return { ...p, items: p.items.map(normSandbox) };
    },
    getSandbox: async (id, signal) => normSandbox(await json<Sandbox>('GET', sb(id), { signal })),
    createSandbox: async (req, signal) =>
      normSandbox(await json<Sandbox>('POST', '/v1/sandboxes', { json: req, signal })),
    terminate: async (id, opts, signal) =>
      normSandbox(
        await json<Sandbox>(
          'DELETE',
          `${sb(id)}${queryString({ retain: opts?.retain?.join(','), reason: opts?.reason })}`,
          { signal },
        ),
      ),
    setEgress: async (id, egress, signal) =>
      normSandbox(await json<Sandbox>('PUT', `${sb(id)}/egress`, { json: { allow: egress.allow }, signal })),
    exec: (id, req, signal) => json<ExecResult>('POST', `${sb(id)}/exec`, { json: req, signal }),

    async execStream(id, req, onEvent, signal) {
      let exit: ExecExit | null = null;
      let failed: ComputeError | null = null;
      await sse(
        'POST',
        `${sb(id)}/exec?stream=1`,
        (event, data) => {
          if (event === 'stdout' || event === 'stderr') {
            onEvent({ type: event, data: chunk(data) });
          } else if (event === 'exit') {
            const d = (data ?? {}) as Partial<ExecExit>;
            exit = {
              exit_code: Number(d.exit_code ?? -1),
              duration_ms: Number(d.duration_ms ?? 0),
              timed_out: !!d.timed_out,
              ...(d.error ? { error: String(d.error) } : {}),
            };
            onEvent({ type: 'exit', exit });
          } else if (event === 'error') {
            const d = (data ?? {}) as { error?: string; code?: string };
            failed = new ComputeError(502, d.error ?? chunk(data) ?? 'exec failed', d.code);
          }
        },
        { json: req, signal },
      );
      if (exit) return exit;
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
      throw failed ?? new ComputeError(502, 'The exec stream ended before the command exited.');
    },

    async putFile(id, path, body, signal) {
      await send('PUT', `${sb(id)}/files${queryString({ path })}`, {
        body: body as BodyInit,
        headers: { 'Content-Type': 'application/octet-stream' },
        signal,
      });
    },
    getFile: async (id, path, signal) =>
      (await send('GET', `${sb(id)}/files${queryString({ path })}`, { signal })).blob(),

    async logs(id, onEvent, signal) {
      await sse(
        'GET',
        `${sb(id)}/logs`,
        (event, data) => {
          if (event === 'stdout' || event === 'stderr') onEvent({ type: event, data: chunk(data) });
          else if (event === 'end') onEvent({ type: 'end' });
        },
        { signal },
      );
    },

    usage: (id, signal) => json<Usage>('GET', `${sb(id)}/usage`, { signal }),

    // Go sends an empty list as null: a secret bound to no host.
    listSecrets: async (signal) =>
      page<SecretSummary>(await json('GET', '/v1/secrets', { signal })).items.map((x) => ({
        ...x,
        hosts: x.hosts ?? [],
      })),
    putSecret: (name, input, opts) =>
      json<void>('PUT', `/v1/secrets/${encodeURIComponent(name)}${queryString({ agent: opts?.agent })}`, {
        json: input,
        signal: opts?.signal,
      }),
    deleteSecret: (name, opts) =>
      json<void>('DELETE', `/v1/secrets/${encodeURIComponent(name)}${queryString({ agent: opts?.agent })}`, {
        signal: opts?.signal,
      }),
    setSandboxSecret: (id, name, value, signal) =>
      json<void>('PUT', `${sb(id)}/secrets/${encodeURIComponent(name)}`, { json: { value }, signal }),

    egressLog: async (q, signal) =>
      page<EgressEntry>(await json('GET', `/v1/sandboxes/egress/log${queryString({ ...q })}`, { signal })),
    usageRecords: async (q, signal) =>
      page<UsageRecord>(await json('GET', `/v1/sandboxes/usage/records${queryString({ ...q })}`, { signal })),
  };
}

/**
 * Follow `next_cursor` until `max` items or the last page. The gateway caps a
 * page at 500; lists on these pages stay well under a few pages.
 */
export async function collect<T>(
  fetchPage: (cursor: string | undefined) => Promise<Page<T>>,
  max = 1000,
): Promise<{ items: T[]; truncated: boolean }> {
  const items: T[] = [];
  let cursor: string | undefined;
  for (;;) {
    const p = await fetchPage(cursor);
    items.push(...p.items);
    if (!p.next_cursor) return { items, truncated: false };
    if (items.length >= max) return { items: items.slice(0, max), truncated: true };
    cursor = p.next_cursor;
  }
}
