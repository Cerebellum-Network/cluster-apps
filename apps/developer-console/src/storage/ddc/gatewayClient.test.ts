import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildRegistrationBody, createGatewayClient } from './gatewayClient';

/**
 * The gateway verifies `X-Signature` over the EXACT raw bytes of this body, so
 * the signer and the sender must produce byte-identical JSON. These tests pin the
 * exact serialization (key presence and order), not just a parsed-equal shape.
 */
describe('buildRegistrationBody', () => {
  it('emits delegation_token first, then label, when a label is given', () => {
    expect(buildRegistrationBody('tok-123', 'developer-console')).toBe(
      '{"delegation_token":"tok-123","label":"developer-console"}',
    );
  });

  it('omits the label key entirely when no label is given', () => {
    expect(buildRegistrationBody('tok-123')).toBe('{"delegation_token":"tok-123"}');
  });

  it('omits the label key for an empty-string label (falsy)', () => {
    expect(buildRegistrationBody('tok-123', '')).toBe('{"delegation_token":"tok-123"}');
  });

  it('JSON-escapes characters in the token so the body stays valid', () => {
    const body = buildRegistrationBody('a"b\\c', 'l');
    expect(body).toBe('{"delegation_token":"a\\"b\\\\c","label":"l"}');
    // And it round-trips to the original value.
    expect(JSON.parse(body).delegation_token).toBe('a"b\\c');
  });

  it('appends device_id after the label when given (fixed key order)', () => {
    expect(buildRegistrationBody('tok-123', 'developer-console', 'dev-abc')).toBe(
      '{"delegation_token":"tok-123","label":"developer-console","device_id":"dev-abc"}',
    );
  });

  it('includes device_id even without a label, so signer and sender match byte-for-byte', () => {
    expect(buildRegistrationBody('tok-123', undefined, 'dev-abc')).toBe(
      '{"delegation_token":"tok-123","device_id":"dev-abc"}',
    );
  });

  it('omits device_id when absent', () => {
    expect(buildRegistrationBody('tok-123', 'l')).toBe('{"delegation_token":"tok-123","label":"l"}');
  });

  it('builds a proxy-backed body: empty delegation_token + device_id + expires_in_seconds', () => {
    expect(buildRegistrationBody('', 'developer-console', 'dev-abc', 2592000)).toBe(
      '{"delegation_token":"","label":"developer-console","device_id":"dev-abc","expires_in_seconds":2592000}',
    );
  });

  it('omits expires_in_seconds when zero or absent', () => {
    expect(buildRegistrationBody('tok', 'l', 'd', 0)).toBe('{"delegation_token":"tok","label":"l","device_id":"d"}');
    expect(buildRegistrationBody('tok', 'l', 'd')).toBe('{"delegation_token":"tok","label":"l","device_id":"d"}');
  });
});

/**
 * /auth/status is tri-state (#189 review): only an explicit
 * `gateway_proxy_registered: false` is "not authorized". Any failure to read the
 * gateway is 'unknown' (a blip), so the caller never mistakes it for a revoke and
 * never blanks an authorized wallet's bucket list.
 */
describe('getAuthStatus (tri-state)', () => {
  const gateway = createGatewayClient('https://gw.test');
  const input = { publicKey: '0xpub', signature: 'sig', signatureType: 'ed25519' };
  const okJson = (body: unknown) => ({ ok: true, json: async () => body }) as unknown as Response;

  afterEach(() => vi.unstubAllGlobals());

  it("returns 'authorized' on explicit gateway_proxy_registered: true", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ gateway_proxy_registered: true })));
    await expect(gateway.getAuthStatus(input)).resolves.toBe('authorized');
  });

  it("returns 'unauthorized' only on explicit gateway_proxy_registered: false", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ gateway_proxy_registered: false })));
    await expect(gateway.getAuthStatus(input)).resolves.toBe('unauthorized');
  });

  it("returns 'unknown' on a non-OK response (a blip, not a revoke)", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) } as unknown as Response));
    await expect(gateway.getAuthStatus(input)).resolves.toBe('unknown');
  });

  it("returns 'unknown' on a network error", async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await expect(gateway.getAuthStatus(input)).resolves.toBe('unknown');
  });

  it("returns 'unknown' on a malformed body with the field missing", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({})));
    await expect(gateway.getAuthStatus(input)).resolves.toBe('unknown');
  });
});
