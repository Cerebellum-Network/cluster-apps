import type { WalletStatus } from '@cef-ai/wallet-react';

/**
 * Where the wallet's boot-time silent resume is. `useWalletConnect` starts at
 * `idle` and only moves to `resuming` in an effect, so its first `idle` means
 * "not asked yet", not "signed out". Pages that need a session wait while this
 * is not `settled` instead of sending a returning user to /login.
 *
 * - `pending`: nothing seen yet but that first `idle`;
 * - `resuming`: the resume is running;
 * - `settled`: the resume answered (signed in or not), or the user started a
 *   sign-in of their own. It never goes back.
 */
export type BootPhase = 'pending' | 'resuming' | 'settled';

export function nextBootPhase(phase: BootPhase, status: WalletStatus): BootPhase {
  if (phase === 'settled') return phase;
  if (status === 'resuming') return 'resuming';
  if (status === 'idle') return phase === 'resuming' ? 'settled' : 'pending';
  return 'settled';
}

/**
 * A resume that answers without any I/O can go idle → resuming → idle inside
 * one React batch, so `resuming` is never rendered and `pending` would last
 * forever. Past this long after mount, `pending` counts as settled. A resume
 * that does reach the wallet shows `resuming` long before this.
 */
export const BOOT_GRACE_MS = 1500;
