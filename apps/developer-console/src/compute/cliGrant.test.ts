// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { AuthToken } from '@cere-ddc-sdk/ddc';
import { decodeAddress, type Signer } from '@cere-ddc-sdk/blockchain';

import { buildCliGrant, keyFingerprint, loopbackCallback, parseCliRequest, postToCli } from './cliGrant';

const KEY = 'a1'.repeat(32);
const STATE = 'Zm9vYmFyYmF6cXV4cXV1eA';

const parse = (q: Record<string, string>) => parseCliRequest(new URLSearchParams(q));

describe('parseCliRequest', () => {
  it('reads a full request from the CLI', () => {
    const r = parse({
      key: KEY.toUpperCase(),
      state: STATE,
      port: '53682',
      code: 'AB12-CD34',
      host: 'my-mac.local',
      days: '30',
    });
    expect(r).toEqual({
      ok: true,
      req: { key: KEY, state: STATE, port: 53682, code: 'AB12-CD34', host: 'my-mac.local', days: 30 },
    });
  });
  it('is paste mode without a port, and 7 days unless the CLI asked for 1 or 30', () => {
    const r = parse({ key: KEY, state: STATE, days: '365' });
    expect(r.ok && r.req.port).toBeNull();
    expect(r.ok && r.req.days).toBe(7);
  });
  it.each([
    [{ state: STATE }, 'key'],
    [{ key: 'xyz', state: STATE }, 'key'],
    [{ key: KEY }, 'state'],
    [{ key: KEY, state: 'short' }, 'state'],
    [{ key: KEY, state: STATE, port: '80' }, 'port'],
    [{ key: KEY, state: STATE, port: '70000' }, 'port'],
    [{ key: KEY, state: STATE, port: '1e4' }, 'port'],
    [{ key: KEY, state: STATE, code: '<script>' }, 'code'],
  ])('refuses %j', (q, what) => {
    const r = parse(q as Record<string, string>);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.toLowerCase()).toContain(what);
  });
  it('drops a host hint that is not a plain name', () => {
    const r = parse({ key: KEY, state: STATE, host: 'evil<b>' });
    expect(r.ok && r.req.host).toBeNull();
  });
});

/** The wallet as the token sees it: a key type, a public key and a signature over the payload. */
const fakeWallet = (): Signer =>
  ({
    type: 'ed25519',
    address: 'owner',
    publicKey: new Uint8Array(32).fill(7),
    isReady: async () => true,
    sign: async () => new Uint8Array(64).fill(9),
  }) as unknown as Signer;

describe('buildCliGrant', () => {
  it('signs a COMPUTE grant for the bucket whose subject is the CLI key and which may delegate', async () => {
    const signer = fakeWallet();
    const before = Date.now();
    const s = await buildCliGrant(signer, { bucketId: 4116n, cliKey: KEY, expiresInMs: 7 * 86_400_000 });
    const t = AuthToken.maybeToken(s)!; // `from` would start a child of it
    expect(t.signature?.algorithm).toBe('ed25519');
    expect(t.bucketId).toBe(4116n);
    expect(t.operations).toEqual([4]);
    expect(t.canDelegate).toBe(true);
    expect(Buffer.from(decodeAddress(t.subject!)).toString('hex')).toBe(KEY);
    expect(t.expiresAt).toBeGreaterThanOrEqual(before + 7 * 86_400_000);
  });
  it('refuses a key that is not one', async () => {
    const signer = fakeWallet();
    await expect(buildCliGrant(signer, { bucketId: 1n, cliKey: 'nope', expiresInMs: 1 })).rejects.toThrow(
      'not a CLI key',
    );
  });
});

describe('delivery', () => {
  it('posts the fields to the loopback port as a hidden form, never in the URL', () => {
    const proto = HTMLFormElement.prototype as unknown as { submit: () => void };
    const orig = proto.submit;
    const submit = vi.fn();
    proto.submit = submit;
    try {
      postToCli(53682, { state: STATE, grant: 'tok' });
    } finally {
      proto.submit = orig;
    }
    expect(submit).toHaveBeenCalledTimes(1);
    const form = submit.mock.contexts[0] as HTMLFormElement;
    expect(form.method.toUpperCase()).toBe('POST');
    expect(form.action).toBe(loopbackCallback(53682));
    expect(form.action).not.toContain('tok');
    expect(new FormData(form).get('grant')).toBe('tok');
    expect(keyFingerprint(KEY)).toBe('a1a1a1a1…a1a1a1a1');
  });
});
