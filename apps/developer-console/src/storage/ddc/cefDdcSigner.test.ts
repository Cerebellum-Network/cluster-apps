import { describe, it, expect, vi } from 'vitest';
import type { CefSigner } from '@cef-ai/wallet';
import { CefDdcSigner } from './cefDdcSigner';

/**
 * The intent map is load-bearing and invisible to a bytes-only test: only
 * 'extrinsic' raises the wallet's consent screen and requires a description, so a
 * mis-mapped intent yields a valid signature with the wrong (or no) prompt. These
 * tests pin how each intent reaches the underlying CefSigner.
 */
function fakeCef(overrides: Partial<CefSigner> = {}): CefSigner {
  return {
    type: 'ed25519',
    address: 'cereAddr',
    publicKey: new Uint8Array([1, 2, 3]),
    isReady: vi.fn(async () => true),
    sign: vi.fn(async () => new Uint8Array([9])),
    ...overrides,
  } as unknown as CefSigner;
}

const bytes = new Uint8Array([4, 5, 6]);

describe('CefDdcSigner.sign intent map', () => {
  it("defaults a missing intent to 'token' (reproduces the 2.x createSignature mapping)", async () => {
    const cef = fakeCef();
    await new CefDdcSigner(() => cef).sign(bytes);
    expect(cef.sign).toHaveBeenCalledWith(bytes, 'token', undefined);
  });

  it("passes 'data' through for raw-message signing (no consent options)", async () => {
    const cef = fakeCef();
    await new CefDdcSigner(() => cef).sign(bytes, 'data');
    expect(cef.sign).toHaveBeenCalledWith(bytes, 'data', undefined);
  });

  it('refuses an extrinsic with no description, without calling the wallet', async () => {
    const cef = fakeCef();
    await expect(new CefDdcSigner(() => cef).sign(bytes, 'extrinsic')).rejects.toThrow(/refusing to sign an extrinsic/i);
    expect(cef.sign).not.toHaveBeenCalled();
  });

  it('carries the describing() text into the consent options for an extrinsic', async () => {
    const cef = fakeCef();
    await new CefDdcSigner(() => cef).describing('Create a storage bucket').sign(bytes, 'extrinsic');
    expect(cef.sign).toHaveBeenCalledWith(bytes, 'extrinsic', { humanReadable: 'Create a storage bucket' });
  });

  it('describing() returns a NEW instance, leaving the original undescribed', async () => {
    const cef = fakeCef();
    const base = new CefDdcSigner(() => cef);
    const described = base.describing('x');
    expect(described).not.toBe(base);
    // The original still refuses an extrinsic (its label was not mutated).
    await expect(base.sign(bytes, 'extrinsic')).rejects.toThrow();
  });
});

describe('CefDdcSigner accessors', () => {
  it('passes type / address / publicKey through from the resolved CefSigner', () => {
    const cef = fakeCef();
    const s = new CefDdcSigner(() => cef);
    expect(s.type).toBe('ed25519');
    expect(s.address).toBe('cereAddr');
    expect(s.publicKey).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('isReady() is false (not a throw) when there is no wallet session yet', async () => {
    const s = new CefDdcSigner(() => {
      throw new Error('no wallet');
    });
    await expect(s.isReady()).resolves.toBe(false);
  });

  it('isReady() delegates to the CefSigner when a session exists', async () => {
    const cef = fakeCef({ isReady: vi.fn(async () => false) });
    await expect(new CefDdcSigner(() => cef).isReady()).resolves.toBe(false);
  });
});
