import { describe, expect, it, vi } from 'vitest';

import { ApiError, ConsoleApi, query } from './client';
import { signIn, toHex } from './signIn';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('signIn', () => {
  it('signs the challenge message as raw bytes and verifies it', async () => {
    const calls: { url: string; body?: unknown }[] = [];
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      calls.push({ url: String(url), body });
      if (String(url).endsWith('/auth/challenge')) {
        return json(200, { challenge_id: 'ch-1', message: 'cluster-console sign-in\nnonce: ab', expires_at: '' });
      }
      return json(200, {
        session: 'tok',
        account: 'aa',
        roles: ['manager'],
        expires_at: '',
        cluster: { id: 'c', name: '' },
      });
    });
    const api = new ConsoleApi('https://backend', () => null, fetchImpl as unknown as typeof fetch);
    const signed: Uint8Array[] = [];
    const signer = {
      type: 'ed25519',
      sign: vi.fn(async (bytes: Uint8Array) => {
        signed.push(bytes);
        return new Uint8Array([0, 1, 254, 255]);
      }),
    };

    const out = await signIn(api, 'aa', signer);
    expect(out.session).toBe('tok');
    expect(new TextDecoder().decode(signed[0])).toBe('cluster-console sign-in\nnonce: ab');
    expect(signer.sign.mock.calls[0][1]).toBe('data');
    expect(calls[0]).toEqual({ url: 'https://backend/api/v1/auth/challenge', body: { account: 'aa' } });
    expect(calls[1].body).toEqual({ challenge_id: 'ch-1', account: 'aa', signature: '0001feff', scheme: 'ed25519' });
  });

  it('passes sr25519 through as the scheme', async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) =>
      String(url).endsWith('/auth/challenge')
        ? json(200, { challenge_id: 'x', message: 'm', expires_at: '' })
        : json(200, JSON.parse(init!.body as string)),
    );
    const api = new ConsoleApi('', () => null, fetchImpl as unknown as typeof fetch);
    const out = (await signIn(api, 'aa', { type: 'sr25519', sign: async () => new Uint8Array([1]) })) as unknown as {
      scheme: string;
    };
    expect(out.scheme).toBe('sr25519');
  });

  it('surfaces a refusal as an ApiError with its code', async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) =>
      String(url).endsWith('/auth/challenge')
        ? json(200, { challenge_id: 'x', message: 'm', expires_at: '' })
        : json(403, { error: 'no role', code: 'no_role' }),
    );
    const api = new ConsoleApi('', () => null, fetchImpl as unknown as typeof fetch);
    await expect(signIn(api, 'aa', { type: 'ed25519', sign: async () => new Uint8Array() })).rejects.toMatchObject({
      status: 403,
      code: 'no_role',
    });
  });
});

describe('ConsoleApi', () => {
  it('sends the session bearer and maps source_unavailable', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer s1');
      return json(503, {
        error: 'answered 404',
        code: 'source_unavailable',
        source: 'resource-manager GET /api/v1/sandboxes',
        source_status: 404,
      });
    });
    const api = new ConsoleApi('https://b', () => 's1', fetchImpl as unknown as typeof fetch);
    const err = await api.get('/sandboxes', { status: 'running', node: '' }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.source).toEqual({
      source: 'resource-manager GET /api/v1/sandboxes',
      status: 404,
      detail: 'answered 404',
    });
    expect(fetchImpl.mock.calls[0][0]).toBe('https://b/api/v1/sandboxes?status=running');
  });

  it('flags 401 as unauthorized', async () => {
    const api = new ConsoleApi('', () => null, (async () =>
      json(401, { code: 'no_session', error: 'x' })) as unknown as typeof fetch);
    const err = await api.get('/summary').catch((e) => e);
    expect(err.isUnauthorized).toBe(true);
  });
});

describe('helpers', () => {
  it('builds queries without empty values', () => {
    expect(query({ a: 'x', b: '', c: undefined, d: null, e: 0 })).toBe('?a=x&e=0');
    expect(query()).toBe('');
  });
  it('hex-encodes', () => {
    expect(toHex(new Uint8Array([0, 15, 16, 255]))).toBe('000f10ff');
  });
});
