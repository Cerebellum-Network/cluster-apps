import { describe, it, expect } from 'vitest';
import { buildRegistrationBody } from './gatewayClient';

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
});
