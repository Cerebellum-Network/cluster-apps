/**
 * Client-side tracking of the account's gateway buckets.
 *
 * The DDC S3 gateway addresses buckets by a string **name** and offers no
 * "list my buckets" endpoint, so the console remembers the names it created,
 * per account, in localStorage. (Old chain-only buckets from the retired stack
 * are not gateway-usable and are intentionally not tracked here.)
 *
 * All access is wrapped in try/catch: localStorage can throw or be empty in a
 * private window, and the UI must still render.
 */

export interface TrackedBucket {
  name: string;
  isPublic: boolean;
}

const bucketsKey = (account: string) => `dc:gwBuckets:${account}`;
const authorizedKey = (account: string) => `dc:gwAuthorized:${account}`;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore: private mode / quota. Tracking is a convenience, not a source of truth.
  }
}

export function listTrackedBuckets(account: string): TrackedBucket[] {
  const list = read<TrackedBucket[]>(bucketsKey(account), []);
  return Array.isArray(list) ? list.filter((b) => b && typeof b.name === 'string') : [];
}

export function addTrackedBucket(account: string, name: string, isPublic: boolean): void {
  const list = listTrackedBuckets(account);
  if (list.some((b) => b.name === name)) return;
  write(bucketsKey(account), [...list, { name, isPublic }]);
}

export function updateTrackedBucket(account: string, name: string, patch: Partial<TrackedBucket>): void {
  const list = listTrackedBuckets(account);
  write(
    bucketsKey(account),
    list.map((b) => (b.name === name ? { ...b, ...patch } : b)),
  );
}

export function isGatewayAuthorized(account: string): boolean {
  return read<boolean>(authorizedKey(account), false) === true;
}

export function setGatewayAuthorized(account: string): void {
  write(authorizedKey(account), true);
}

/** Clear the "gateway authorized" flag (after revoking the gateway's proxy). */
export function clearGatewayAuthorized(account: string): void {
  try {
    localStorage.removeItem(authorizedKey(account));
  } catch {
    // Ignore: private mode. The flag is a convenience, not a source of truth.
  }
}

/**
 * A fresh, S3-valid bucket name: lowercase, 3–63 chars, `[a-z0-9-]`, starts/ends
 * alphanumeric, no `_`. `dc-<base36 time>-<random>` is unique enough per account.
 */
export function generateBucketName(): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `dc-${time}-${rand}`.toLowerCase();
}
