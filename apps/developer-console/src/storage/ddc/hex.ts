/** Hex helpers for the DDC gateway signing (ported from ROC's @/utils/hex usage). */

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

/** Hex (with or without `0x`) to bytes. */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error(`odd-length hex: ${hex}`);
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** `0x`-prefixed hex of a byte array (the form the gateway's `X-Public-Key` wants). */
export function hexWithPrefix(bytes: Uint8Array): string {
  return `0x${bytesToHex(bytes)}`;
}
