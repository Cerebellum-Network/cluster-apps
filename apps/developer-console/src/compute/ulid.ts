/**
 * A ULID (https://github.com/ulid/spec): 48-bit millisecond time + 80 random
 * bits, Crockford base32, 26 characters, sortable by creation time. Written in
 * lower case, like the sandbox ids (`sb-` + lowercase ULID). The agent layer
 * labels every run's sandbox `cere.run=<ULID>`.
 */
const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';

export function ulid(now = Date.now(), random: (n: number) => Uint8Array = randomBytes): string {
  let t = Math.floor(now);
  let time = '';
  for (let i = 0; i < 10; i += 1) {
    time = ALPHABET[t % 32] + time;
    t = Math.floor(t / 32);
  }
  // 80 random bits = 16 base32 characters; 10 bytes give exactly 80 bits.
  const bytes = random(10);
  let bits = 0;
  let value = 0;
  let rand = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      rand += ALPHABET[(value >> bits) & 31];
    }
    value &= (1 << bits) - 1;
  }
  return time + rand;
}

function randomBytes(n: number): Uint8Array {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}

export const ULID_RE = /^[0-9a-hjkmnp-tv-z]{26}$/;
