import { describe, expect, it } from 'vitest';

import {
  collect,
  ComputeError,
  createComputeClient,
  errorMessage,
  isNoBalance,
  isTokenRejected,
  queryString,
} from './client';
import type { ExecEvent } from './types';

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };

/** A fetch that records each call and answers from `reply`. */
function stubFetch(reply: (c: Call) => Response) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const c: Call = {
      url: String(input),
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body,
    };
    calls.push(c);
    return reply(c);
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const sse = (text: string) =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode(text));
        c.close();
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  );

const BASE = 'https://agent-gateway.example';

describe('createComputeClient', () => {
  it('sends the token as a bearer and lists with repeated label filters', async () => {
    // Go sends empty lists as null; the client hands pages empty values instead.
    const { calls, fetchImpl } = stubFetch(() =>
      json(200, {
        items: [
          { id: 'sb-1', labels: null, retained: null, env_keys: null, egress: { allow: null }, usage: { cpu_s: 2 } },
        ],
        next_cursor: null,
      }),
    );
    const c = createComputeClient('tok', `${BASE}/`, fetchImpl);
    const page = await c.listSandboxes({
      status: 'running',
      label: ['cere.kind:agent-run', 'cere.agent:sre'],
      limit: 100,
    });
    expect(page.next_cursor).toBeNull();
    expect(page.items[0]).toMatchObject({
      id: 'sb-1',
      labels: {},
      retained: [],
      env_keys: [],
      egress: { allow: [] },
      command: [],
    });
    expect(page.items[0].usage).toMatchObject({ cpu_s: 2, ram_gib_s: 0 });
    expect(calls[0].headers.Authorization).toBe('Bearer tok');
    expect(calls[0].url).toBe(
      `${BASE}/v1/sandboxes?status=running&label=cere.kind%3Aagent-run&label=cere.agent%3Asre&limit=100`,
    );
  });

  it("replaces a running sandbox's allow-list with PUT /egress and returns the sandbox", async () => {
    const { calls, fetchImpl } = stubFetch(() =>
      json(200, { id: 'sb-1', status: 'running', egress: { allow: [{ host: 'example.com', methods: ['GET'] }] } }),
    );
    const c = createComputeClient('tok', BASE, fetchImpl);
    const sb = await c.setEgress('sb-1', { allow: [{ host: 'example.com', methods: ['GET'] }] });
    expect(calls[0].method).toBe('PUT');
    expect(calls[0].url).toBe(`${BASE}/v1/sandboxes/sb-1/egress`);
    expect(JSON.parse(String(calls[0].body))).toEqual({ allow: [{ host: 'example.com', methods: ['GET'] }] });
    expect(sb.egress.allow).toHaveLength(1);
    expect(sb.labels).toEqual({});
  });

  it('surfaces a refused rule change with its code', async () => {
    const { fetchImpl } = stubFetch(() =>
      json(400, { error: 'secret github-readonly is not bound to example.com', code: 'credential_not_bound' }),
    );
    const c = createComputeClient('tok', BASE, fetchImpl);
    const err = await c.setEgress('sb-1', { allow: [] }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ComputeError);
    expect((err as ComputeError).code).toBe('credential_not_bound');
    expect((err as ComputeError).status).toBe(400);
  });

  it('creates with a JSON body and terminates with retain and reason', async () => {
    const { calls, fetchImpl } = stubFetch((c) =>
      json(c.method === 'POST' ? 201 : 200, { id: 'sb-1', status: 'starting' }),
    );
    const c = createComputeClient('tok', BASE, fetchImpl);
    await c.createSandbox({ image: 'python:3.12-slim', resources: { cpu: 1, memory: 1024 } });
    expect(calls[0].method).toBe('POST');
    expect(calls[0].headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(String(calls[0].body))).toMatchObject({ image: 'python:3.12-slim' });
    await c.terminate('sb-1', { retain: ['/workspace/a', '/workspace/b'], reason: 'done' });
    expect(calls[1].method).toBe('DELETE');
    expect(calls[1].url).toBe(`${BASE}/v1/sandboxes/sb-1?retain=%2Fworkspace%2Fa%2C%2Fworkspace%2Fb&reason=done`);
  });

  it('surfaces the gateway error envelope with its code', async () => {
    const { fetchImpl } = stubFetch(() => json(409, { error: 'sandbox is not running', code: 'not_running' }));
    const c = createComputeClient('tok', BASE, fetchImpl);
    const err = await c.exec('sb-1', { command: ['true'] }).catch((e) => e);
    expect(err).toBeInstanceOf(ComputeError);
    expect(err).toMatchObject({ status: 409, code: 'not_running', message: 'sandbox is not running' });
    expect(isTokenRejected(err)).toBe(false);
    expect(isTokenRejected(new ComputeError(401, 'token expired'))).toBe(true);
    expect(isTokenRejected(new ComputeError(403, 'bucket owner has insufficient balance'))).toBe(false);
  });

  it('tells a refusal for balance by its code, or by the message a page kept of it', () => {
    const refused = new ComputeError(403, 'bucket owner has insufficient balance', 'insufficient_balance');
    expect(isNoBalance(refused)).toBe(true);
    expect(isNoBalance(errorMessage(refused))).toBe(true);
    expect(isNoBalance(new ComputeError(403, 'forbidden', 'forbidden'))).toBe(false);
    expect(isNoBalance('502 bad gateway')).toBe(false);
  });

  it('streams exec output and resolves with the exit', async () => {
    const { calls, fetchImpl } = stubFetch(() =>
      sse(
        ': ping\n\nevent: stdout\ndata: {"data":"hello "}\n\nevent: stderr\ndata: {"data":"warn\\n"}\n\n' +
          'event: stdout\ndata: {"data":"world\\n"}\n\nevent: exit\ndata: {"exit_code":3,"duration_ms":12,"timed_out":false}\n\n',
      ),
    );
    const c = createComputeClient('tok', BASE, fetchImpl);
    const events: ExecEvent[] = [];
    const exit = await c.execStream('sb-1', { command: ['sh', '-c', 'x'] }, (e) => events.push(e));
    expect(calls[0].url).toBe(`${BASE}/v1/sandboxes/sb-1/exec?stream=1`);
    expect(calls[0].headers.Accept).toBe('text/event-stream');
    expect(exit).toEqual({ exit_code: 3, duration_ms: 12, timed_out: false });
    expect(
      events
        .filter((e) => e.type === 'stdout')
        .map((e) => (e as { data: string }).data)
        .join(''),
    ).toBe('hello world\n');
    expect(events.some((e) => e.type === 'stderr' && e.data === 'warn\n')).toBe(true);
  });

  it('rejects an exec stream that ends without an exit', async () => {
    const { fetchImpl } = stubFetch(() => sse('event: stdout\ndata: {"data":"x"}\n\n'));
    const c = createComputeClient('tok', BASE, fetchImpl);
    await expect(c.execStream('sb-1', { command: ['x'] }, () => undefined)).rejects.toMatchObject({ status: 502 });
  });

  it('reads logs until end, and puts files as raw bodies', async () => {
    const { calls, fetchImpl } = stubFetch((c) =>
      c.url.includes('/logs')
        ? sse('event: stdout\ndata: {"data":"a\\n"}\n\nevent: end\ndata: {}\n\n')
        : new Response(null, { status: 204 }),
    );
    const c = createComputeClient('tok', BASE, fetchImpl);
    const seen: string[] = [];
    await c.logs('sb-1', (e) => seen.push(e.type === 'end' ? 'end' : e.data));
    expect(seen).toEqual(['a\n', 'end']);
    await c.putFile('sb-1', '/workspace/a b.txt', 'hi');
    expect(calls[1].method).toBe('PUT');
    expect(calls[1].url).toBe(`${BASE}/v1/sandboxes/sb-1/files?path=%2Fworkspace%2Fa+b.txt`);
    expect(calls[1].headers['Content-Type']).toBe('application/octet-stream');
    expect(calls[1].body).toBe('hi');
  });

  it('puts a secret without echoing it and lists names only', async () => {
    const { calls, fetchImpl } = stubFetch((c) =>
      c.method === 'PUT'
        ? new Response(null, { status: 204 })
        : json(200, { items: [{ name: 'gh', type: 'header', header: 'Authorization' }] }),
    );
    const c = createComputeClient('tok', BASE, fetchImpl);
    await c.putSecret('gh', { type: 'header', header: 'Authorization', value: 'Bearer x', hosts: ['api.github.com'] });
    expect(calls[0].url).toBe(`${BASE}/v1/secrets/gh`);
    expect(JSON.parse(String(calls[0].body)).hosts).toEqual(['api.github.com']);
    // A secret bound to no host comes back with an empty list (Go sends null or leaves it out).
    expect(await c.listSecrets()).toEqual([{ name: 'gh', type: 'header', header: 'Authorization', hosts: [] }]);
  });

  it('stores and deletes an agent’s secret, and replaces a running sandbox’s own', async () => {
    const { calls, fetchImpl } = stubFetch(() => new Response(null, { status: 204 }));
    const c = createComputeClient('tok', BASE, fetchImpl);
    await c.putSecret(
      'gh',
      { type: 'header', header: 'Authorization', value: 'Bearer x', hosts: ['a.b'] },
      { agent: 'sre' },
    );
    await c.deleteSecret('gh', { agent: 'sre' });
    await c.deleteSecret('gh');
    await c.setSandboxSecret('sb-1', 'slack-a', 'Bearer new');
    expect(calls.map((x) => `${x.method} ${x.url.slice(BASE.length)}`)).toEqual([
      'PUT /v1/secrets/gh?agent=sre',
      'DELETE /v1/secrets/gh?agent=sre',
      'DELETE /v1/secrets/gh',
      'PUT /v1/sandboxes/sb-1/secrets/slack-a',
    ]);
    expect(JSON.parse(String(calls[3].body))).toEqual({ value: 'Bearer new' });
  });

  it('sends and reads resources under the API’s names, as they are', async () => {
    const { calls, fetchImpl } = stubFetch(() =>
      json(201, {
        id: 'sb-1',
        status: 'starting',
        resources: { cpu: 0.25, memory: 128, cpu_limit: 4, memory_limit: 1024, disk: 2048 },
        secrets: [{ name: 'gh', type: 'header', header: 'Authorization', hosts: null }],
      }),
    );
    const c = createComputeClient('tok', BASE, fetchImpl);
    const sb = await c.createSandbox({
      image: 'python:3.12-slim',
      resources: { cpu: 0.25, memory: 128, memory_limit: 1024, disk: 2048 },
      secrets: [{ name: 'gh', type: 'header', header: 'Authorization', value: 'Bearer x', hosts: ['api.github.com'] }],
    });
    const body = JSON.parse(String(calls[0].body));
    expect(body.resources).toEqual({ cpu: 0.25, memory: 128, memory_limit: 1024, disk: 2048 });
    expect(body.secrets[0].hosts).toEqual(['api.github.com']);
    expect(sb.resources).toEqual({ cpu: 0.25, memory: 128, cpu_limit: 4, memory_limit: 1024, disk: 2048 });
    expect(sb.secrets).toEqual([{ name: 'gh', type: 'header', header: 'Authorization', hosts: [] }]);
  });
});

describe('queryString', () => {
  it('skips empty values and repeats arrays', () => {
    expect(queryString({ a: '', b: undefined, c: null, d: 0, e: ['x', '', 'y'] })).toBe('?d=0&e=x&e=y');
    expect(queryString({})).toBe('');
  });
});

describe('collect', () => {
  it('follows cursors and stops at max', async () => {
    const pages: Record<string, { items: number[]; next_cursor: string | null }> = {
      '': { items: [1, 2], next_cursor: 'b' },
      b: { items: [3, 4], next_cursor: 'c' },
      c: { items: [5], next_cursor: null },
    };
    expect(await collect(async (cur) => pages[cur ?? ''])).toEqual({ items: [1, 2, 3, 4, 5], truncated: false });
    expect(await collect(async (cur) => pages[cur ?? ''], 3)).toEqual({ items: [1, 2, 3], truncated: true });
  });
});
