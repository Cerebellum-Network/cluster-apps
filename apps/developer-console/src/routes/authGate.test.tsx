import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, type NavigateProps } from 'react-router-dom';

import { AppStoreContext } from '../hooks';
import type { AppStore } from '../stores';
import { SessionContext, type Session, type SessionState } from '../wallet/session';
import { BOOT_GRACE_MS, nextBootPhase, type BootPhase } from '../wallet/bootPhase';
import type { WalletStatus } from '@cef-ai/wallet-react';
import Home from './Home/Home';
import Login from './Login/Login';
import { homeGate, returnPath } from './authGate';

// A server render never runs <Navigate>'s effect, so it renders where it would go instead.
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  Navigate: ({ to, state }: NavigateProps) => <a data-to={String(to)} data-state={JSON.stringify(state ?? null)} />,
}));

/** The phase after the hook reports each status in turn. */
const phaseAfter = (...statuses: WalletStatus[]): BootPhase => statuses.reduce<BootPhase>(nextBootPhase, 'pending');

describe('nextBootPhase', () => {
  it('waits through the first idle, which is the hook before it has asked', () => {
    expect(phaseAfter('idle')).toBe('pending');
    expect(phaseAfter('idle', 'resuming')).toBe('resuming');
  });

  it('settles when the resume answers, signed in or not', () => {
    expect(phaseAfter('idle', 'resuming', 'connected')).toBe('settled');
    expect(phaseAfter('idle', 'resuming', 'idle')).toBe('settled');
  });

  it('settles at once on a sign-in the user started', () => {
    expect(phaseAfter('idle', 'connecting')).toBe('settled');
    expect(phaseAfter('idle', 'registering')).toBe('settled');
    expect(phaseAfter('idle', 'error')).toBe('settled');
  });

  it('never goes back once settled', () => {
    expect(phaseAfter('idle', 'resuming', 'idle', 'resuming')).toBe('settled');
    expect(phaseAfter('idle', 'resuming', 'connected', 'idle')).toBe('settled');
  });

  it('has a grace period short enough not to hold a signed-out user', () => {
    expect(BOOT_GRACE_MS).toBeGreaterThan(0);
    expect(BOOT_GRACE_MS).toBeLessThanOrEqual(3000);
  });
});

describe('homeGate', () => {
  const gate = (state: SessionState, resuming: boolean) => homeGate({ state, resuming });

  it('waits while the boot resume runs, whatever the state says', () => {
    // useWalletConnect starts idle and resumes in an effect: that first idle is not "signed out".
    expect(gate('idle', true)).toBe('wait');
    expect(gate('connecting', true)).toBe('wait');
  });

  it('waits during a sign-in in progress', () => {
    expect(gate('connecting', false)).toBe('wait');
  });

  it('sends a settled, signed-out session to /login', () => {
    for (const s of ['idle', 'expired', 'error', 'waiting'] as const) expect(gate(s, false)).toBe('login');
  });

  it('lets a connected session in, even before the resume flag clears', () => {
    expect(gate('connected', false)).toBe('app');
    expect(gate('connected', true)).toBe('app');
  });
});

describe('returnPath', () => {
  const from = (pathname: string, search = '', hash = '') => ({ from: { pathname, search, hash } });

  it('returns to the page, query and hash included', () => {
    expect(returnPath(from('/inference/usage'))).toBe('/inference/usage');
    expect(returnPath(from('/billing', '?checkout=success'))).toBe('/billing?checkout=success');
    expect(returnPath(from('/inference', '?quickstart=1', '#step-2'))).toBe('/inference?quickstart=1#step-2');
  });

  it('falls back to / without a usable from', () => {
    for (const s of [undefined, null, 'x', 42, {}, { from: null }, { from: '/billing' }, { from: { pathname: 7 } }]) {
      expect(returnPath(s)).toBe('/');
    }
  });

  it('never leaves the app', () => {
    expect(returnPath(from('//evil.example/x'))).toBe('/');
    expect(returnPath(from('/\\evil.example'))).toBe('/');
    expect(returnPath(from('https://evil.example/'))).toBe('/');
    expect(returnPath(from('evil.example'))).toBe('/');
    expect(returnPath(from('/\t/evil.example'))).toBe('/');
    expect(returnPath(from('/billing', 'x=1'))).toBe('/');
    expect(returnPath(from('/billing', '', 'top'))).toBe('/');
  });

  it('never loops back to /login', () => {
    expect(returnPath(from('/login'))).toBe('/');
    expect(returnPath(from('/login', '?x=1'))).toBe('/');
  });
});

describe('Home and Login', () => {
  const session = (over: Partial<Session>): Session => ({
    state: 'idle',
    resuming: false,
    account: null,
    lastAccount: null,
    address: null,
    email: null,
    error: null,
    devView: false,
    connect: () => {},
    createWallet: () => {},
    cancel: () => {},
    signOut: () => {},
    getSigner: () => {
      throw new Error('no wallet');
    },
    delegation: null,
    ...over,
  });
  const store = { accountStore: { isReady: () => false } } as unknown as AppStore;
  const render = (s: Session, entry: string | { pathname: string; search?: string; state?: unknown }, page = <Home apps={[]} />) =>
    renderToStaticMarkup(
      <SessionContext.Provider value={s}>
        <AppStoreContext.Provider value={store}>
          <MemoryRouter initialEntries={[entry]}>{page}</MemoryRouter>
        </AppStoreContext.Provider>
      </SessionContext.Provider>,
    );
  const target = (html: string) => {
    const m = /data-to="([^"]*)" data-state="([^"]*)"/.exec(html);
    return m ? { to: m[1], state: JSON.parse(m[2].replace(/&quot;/g, '"')) } : null;
  };

  it('shows the loading screen, not a redirect, while a Stripe return resumes the session', () => {
    const html = render(session({ state: 'idle', resuming: true }), '/billing?checkout=success');
    expect(html).toContain('aria-label="Signing you in"');
    expect(target(html)).toBeNull();
  });

  it('sends a settled signed-out session to /login, remembering the page', () => {
    const t = target(render(session({ state: 'idle', resuming: false }), '/billing?checkout=success'));
    expect(t?.to).toBe('/login');
    expect(t?.state.from).toMatchObject({ pathname: '/billing', search: '?checkout=success' });
  });

  it('keeps waiting while the store catches up with a connected session (the header reads the account)', () => {
    const html = render(session({ state: 'connected', account: 'ab' }), '/billing?checkout=success');
    expect(html).toContain('aria-label="Signing you in"');
  });

  it('Login returns a connected user to that page', () => {
    const from = { pathname: '/inference/usage', search: '', hash: '' };
    const t = target(render(session({ state: 'connected', account: 'ab' }), { pathname: '/login', state: { from } }, <Login />));
    expect(t?.to).toBe('/inference/usage');
  });

  it('Login ignores a ?from= in the URL and goes to /', () => {
    const t = target(render(session({ state: 'connected', account: 'ab' }), '/login?from=%2F%2Fevil.example', <Login />));
    expect(t?.to).toBe('/');
  });
});
