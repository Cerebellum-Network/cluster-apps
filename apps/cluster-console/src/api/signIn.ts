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
 *
 * The console asks for the signature as soon as the wallet is connected, in
 * the same click: a wallet that has just logged in signs data without a prompt
 * (only the `extrinsic` intent raises a consent screen), and a resumed wallet
 * runs one passkey step-up in its own frame. `onSigned` fires once the wallet
 * has signed, while the backend checks the signature and reads the roles.
 */
export async function signIn(
  api: ConsoleApi,
  account: string,
  signer: ChallengeSigner,
  onSigned?: () => void,
): Promise<SessionInfo> {
  const challenge = await api.challenge(account);
  const signature = await signer.sign(new TextEncoder().encode(challenge.message), 'data', {
    humanReadable: challenge.message,
  });
  onSigned?.();
  const scheme = signer.type === 'sr25519' ? 'sr25519' : 'ed25519';
  return api.verify({ challenge_id: challenge.challenge_id, account, signature: toHex(signature), scheme });
}

/** Wallet error codes that mean "the wallet needs one more click from the page" to sign. */
const NEEDS_CLICK = new Set(['gesture-required', 'popup-blocked']);

export function needsClick(e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === 'string' && NEEDS_CLICK.has(code);
}

/** A wallet error in the console's words; null when it is not the wallet's. */
export function walletMessage(e: unknown): string | null {
  const code = (e as { code?: unknown } | null)?.code;
  if (typeof code !== 'string') return null;
  switch (code) {
    case 'user-cancelled':
    case 'popup-closed':
      return 'Sign-in was cancelled in the wallet.';
    case 'popup-blocked':
      return 'The browser blocked the wallet window. Allow pop-ups for this site and try again.';
    case 'unauthorized':
      return 'The wallet session ended. Sign in again.';
    default:
      return null;
  }
}
