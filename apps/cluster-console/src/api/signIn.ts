import type { ConsoleApi } from './client';
import type { SessionInfo } from './types';

/** The part of the wallet's signer sign-in needs (`CefSigner` from @cef-ai/wallet). */
export interface ChallengeSigner {
  readonly type: string;
  sign(
    bytes: Uint8Array,
    intent?: 'data' | 'token' | 'extrinsic',
    opts?: { humanReadable?: string },
  ): Promise<Uint8Array>;
}

export const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

/**
 * Wallet challenge sign-in (DESIGN 3.3): the backend issues a challenge for the
 * account, the SSCP wallet signs its message as raw bytes, and the backend
 * checks the signature and reads the account's roles from the blockchain.
 * Call it from a click: the wallet may need a user gesture to sign.
 */
export async function signIn(api: ConsoleApi, account: string, signer: ChallengeSigner): Promise<SessionInfo> {
  const challenge = await api.challenge(account);
  const signature = await signer.sign(new TextEncoder().encode(challenge.message), 'data', {
    humanReadable: challenge.message,
  });
  const scheme = signer.type === 'sr25519' ? 'sr25519' : 'ed25519';
  return api.verify({ challenge_id: challenge.challenge_id, account, signature: toHex(signature), scheme });
}
