/**
 * The backend session lives in sessionStorage: it is a bearer for this tab,
 * gone when the tab closes, and never in a URL.
 */
const KEY = 'cluster-console.session';

export interface StoredSession {
  token: string;
  account: string;
  expiresAt: string;
}

export function loadStored(now: number = Date.now()): StoredSession | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredSession;
    if (!s.token || Date.parse(s.expiresAt) <= now) {
      window.sessionStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function saveStored(s: StoredSession) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Private mode or storage blocked: the session lasts until reload.
  }
}

export function clearStored() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
