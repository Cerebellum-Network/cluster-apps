/**
 * The token Inference → Usage reads the gateway with, cached in localStorage
 * per (account, bucket) until it expires, so the wallet is asked once a day,
 * not on every visit.
 *
 * The gateway's /api/v1/metrics and /api/v1/limits sit behind the same
 * COMPUTE check as inference (ddc-node pkg/shared/auth tokenmiddleware): there
 * is no read-only DDC operation, so this token could also run inference billed
 * to the bucket. That is why it lives 24h, not weeks.
 */

/** How long a minted usage token lives. */
export const USAGE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
/** A cached token this close to expiry is treated as gone, so a read never races it. */
export const USAGE_TOKEN_MARGIN_MS = 5 * 60 * 1000;

const PREFIX = 'dc.inference.usageToken';

export interface CachedToken {
  token: string;
  expiresAt: number;
}

export const usageTokenKey = (account: string, bucketId: string): string => `${PREFIX}:${account}:${bucketId}`;

/** The minimal Storage surface used, so tests can pass a Map-backed fake. */
export type TokenStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function storage(): TokenStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The cached token for (account, bucket), or null when none, unreadable, or about to expire. */
export function readUsageToken(account: string, bucketId: string, nowMs = Date.now(), store = storage()): string | null {
  if (!store) return null;
  try {
    const raw = store.getItem(usageTokenKey(account, bucketId));
    if (!raw) return null;
    const c = JSON.parse(raw) as Partial<CachedToken>;
    if (typeof c.token !== 'string' || typeof c.expiresAt !== 'number') return null;
    if (c.expiresAt - USAGE_TOKEN_MARGIN_MS <= nowMs) {
      store.removeItem(usageTokenKey(account, bucketId));
      return null;
    }
    return c.token;
  } catch {
    return null;
  }
}

export function writeUsageToken(account: string, bucketId: string, token: string, expiresAt: number, store = storage()): void {
  try {
    store?.setItem(usageTokenKey(account, bucketId), JSON.stringify({ token, expiresAt } satisfies CachedToken));
  } catch {
    /* storage full or blocked: the token stays in memory for this visit */
  }
}

export function dropUsageToken(account: string, bucketId: string, store = storage()): void {
  try {
    store?.removeItem(usageTokenKey(account, bucketId));
  } catch {
    /* nothing to drop */
  }
}
