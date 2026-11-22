import type { SessionState } from '~/wallet/session';

/**
 * What the signed-in shell shows for a session:
 * - `wait` while the boot-time resume or a sign-in is still running, so a
 *   returning user on a deep link (or back from Stripe) keeps their URL;
 * - `login` once there is definitely no session;
 * - `app` when connected.
 */
export function homeGate(s: { state: SessionState; resuming: boolean }): 'wait' | 'login' | 'app' {
  if (s.state === 'connected') return 'app';
  if (s.resuming || s.state === 'connecting') return 'wait';
  return 'login';
}

/** Router state the shell hands /login: where the user was going. */
export interface LoginState {
  from: { pathname: string; search?: string; hash?: string };
}

/**
 * Where /login sends a user once connected: back to `state.from` (path,
 * query and hash), or `/`. `state` is router state, which only this app
 * writes; it is still checked to be a same-app path, so a crafted value can
 * never send the user off-site (`//host`, `/\host`, a scheme, a control character) or back to /login.
 */
export function returnPath(state: unknown): string {
  const from = (state as Partial<LoginState> | null | undefined)?.from;
  if (!from || typeof from !== 'object') return '/';
  const { pathname, search = '', hash = '' } = from;
  if (typeof pathname !== 'string' || typeof search !== 'string' || typeof hash !== 'string') return '/';
  // URL parsers drop tabs and newlines, so "/\t/host" would read as "//host".
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(pathname + search + hash)) return '/';
  if (!pathname.startsWith('/') || pathname.startsWith('//') || pathname.includes('\\')) return '/';
  if (pathname === '/login' || pathname.startsWith('/login/')) return '/';
  if (search && !search.startsWith('?')) return '/';
  if (hash && !hash.startsWith('#')) return '/';
  return `${pathname}${search}${hash}`;
}
