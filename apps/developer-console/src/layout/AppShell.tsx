import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { config } from '../config';
import { short } from '../lib/format';
import { useIsMobile } from '../lib/useIsMobile';
import { useThemeMode } from '../theme/ThemeMode';
import { useSession } from '../wallet/session';
import { Btn, CereMark, Mono, TagPill } from '../components/ui';

const TABS = [
  ['/storage', 'Storage'],
  ['/models', 'Models'],
] as const;

/** Content column: max 960px, 16px side padding, 24px gap, 48px bottom padding. */
export function Page({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: 'var(--b-bg)', color: 'var(--b-tx)', padding: '0 16px 48px', minHeight: '100vh' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>{children}</div>
    </div>
  );
}

function ThemeToggle() {
  const { mode, toggle } = useThemeMode();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={mode === 'dark' ? 'Light theme' : 'Dark theme'}
      style={{
        width: 38,
        height: 38,
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        border: '1px solid var(--b-line2)',
        background: 'transparent',
        color: 'var(--b-tx2)',
        cursor: 'pointer',
      }}
    >
      {mode === 'dark' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
    </button>
  );
}

function NetworkPill() {
  return <TagPill accent={config.network === 'mainnet'}>{config.network}</TagPill>;
}

function Header() {
  const s = useSession();
  const mobile = useIsMobile();
  const key = short(s.account ?? s.lastAccount);
  const address = s.address ? short(s.address) : null;

  if (mobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CereMark size={22} />
          <div style={{ font: '500 18px/1.3 var(--font-sans)', flex: 1 }}>Developer Console</div>
          <ThemeToggle />
          {!s.devView && (
            <Btn variant="outline" style={{ font: '500 13px/1 var(--font-sans)', padding: '10px 12px', minHeight: 44 }} onClick={s.signOut}>
              Sign out
            </Btn>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', font: '400 12px/1.4 var(--font-sans)', color: 'var(--b-tx2)' }}>
          <Mono style={{ font: '500 12px/1 var(--font-mono)', color: 'var(--b-tx)' }}>{key}</Mono>
          <NetworkPill />
          {address && <Mono style={{ font: '500 12px/1 var(--font-mono)' }}>{address}</Mono>}
        </div>
        <nav
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
            border: '1px solid var(--b-line)',
            borderRadius: 999,
            padding: 3,
            background: 'var(--b-card)',
          }}
        >
          {TABS.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                textAlign: 'center',
                font: '500 13px/1 var(--font-sans)',
                padding: '12px 0',
                borderRadius: 999,
                textDecoration: 'none',
                background: isActive ? 'var(--b-acc)' : 'transparent',
                color: isActive ? '#fff' : 'var(--b-tx2)',
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 24 }}>
        <CereMark size={26} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
          <div style={{ font: '500 20px/1.3 var(--font-sans)', letterSpacing: '0.15px' }}>Developer Console</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: '400 12px/1.4 var(--font-sans)', color: 'var(--b-tx2)' }}>
            <span>Account</span>
            <Mono style={{ font: '500 13px/1 var(--font-mono)', color: 'var(--b-tx)' }}>{key}</Mono>
            <NetworkPill />
          </div>
        </div>
        {address && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              border: '1px solid var(--b-line)',
              borderRadius: 12,
              background: 'var(--b-card)',
            }}
            title={s.email ?? s.address ?? undefined}
          >
            <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--b-fill-ok)' }} />
            <Mono style={{ font: '500 13px/1 var(--font-mono)' }}>{address}</Mono>
          </div>
        )}
        <ThemeToggle />
        {!s.devView && (
          <Btn variant="outline" size="sm" onClick={s.signOut}>
            Sign out
          </Btn>
        )}
      </div>
      <nav style={{ display: 'flex', borderBottom: '1px solid var(--b-line)' }}>
        {TABS.map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              padding: '12px 18px',
              font: '500 14px/1 var(--font-sans)',
              textDecoration: 'none',
              color: isActive ? 'var(--b-tx)' : 'var(--b-tx2)',
              borderBottom: `2px solid ${isActive ? 'var(--b-acc)' : 'transparent'}`,
              marginBottom: -1,
            })}
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** Header + nav around an authenticated page. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <Page>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Header />
      </div>
      {children}
    </Page>
  );
}
