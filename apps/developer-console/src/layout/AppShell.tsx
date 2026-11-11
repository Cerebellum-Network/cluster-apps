import type { ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { config } from '../config';
import { runway, short } from '../lib/format';
import { useIsMobile } from '../lib/useIsMobile';
import { useThemeMode } from '../theme/ThemeMode';
import { useSession } from '../wallet/session';
import { Alert, Btn, CereMark, Mono, TagPill } from '../components/ui';
import { burnPerDay } from '../billing/model';
import { useBalance, useBills, useProfile } from '../billing/queries';

/** Primary navigation: one entry per top-level tab, rendered down the sidebar. */
const TABS = [
  { to: '/storage', label: 'Storage', icon: StorageIcon },
  { to: '/models', label: 'Models', icon: ModelsIcon },
  { to: '/billing', label: 'Billing', icon: BillingIcon },
] as const;

/** Billing's secondary nav, nested under the Billing entry while /billing/* is open. */
const BILLING_SUB = [
  { to: '/billing', label: 'Overview', end: true },
  { to: '/billing/bills', label: 'Bills', end: false },
  { to: '/billing/payments', label: 'Payments', end: false },
] as const;

// ── sidebar icons (18px, stroke = currentColor) ──────────────────────────────
function StorageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
      <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </svg>
  );
}
function ModelsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M9 9h6v6H9z" />
      <path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
    </svg>
  );
}
function BillingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v16l-2.5-1.5L15 20l-3-1.5L9 20l-2.5-1.5L4 20z" />
      <path d="M8 9h8M8 13h5" />
    </svg>
  );
}

function ThemeToggle({ size = 38 }: { size?: number }) {
  const { mode, toggle } = useThemeMode();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={mode === 'dark' ? 'Light theme' : 'Dark theme'}
      style={{
        width: size,
        height: size,
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
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

// ── desktop: left sidebar ────────────────────────────────────────────────────
function Sidebar() {
  const s = useSession();
  const { pathname } = useLocation();
  const key = short(s.account ?? s.lastAccount);
  const onBilling = pathname === '/billing' || pathname.startsWith('/billing/');

  return (
    <aside
      style={{
        position: 'sticky',
        top: 12,
        alignSelf: 'start',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: '20px 14px',
        background: 'var(--b-card)',
        border: '1px solid var(--b-line)',
        borderRadius: 14,
        minHeight: 'calc(100vh - 24px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 6px' }}>
        <CereMark size={24} />
        <div style={{ font: '600 15px/1.2 var(--font-sans)' }}>Developer Console</div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {TABS.map(({ to, label, icon: Icon }) => (
          <div key={to}>
            <NavLink
              to={to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 9,
                font: '500 14px/1 var(--font-sans)',
                textDecoration: 'none',
                background: isActive ? 'var(--b-acc-soft)' : 'transparent',
                color: isActive ? 'var(--b-acc-tx)' : 'var(--b-tx2)',
              })}
            >
              <span style={{ display: 'flex', opacity: 0.9 }}>
                <Icon />
              </span>
              {label}
            </NavLink>

            {to === '/billing' && onBilling && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  margin: '10px 0 4px 15px',
                  paddingLeft: 11,
                  borderLeft: '1px solid var(--b-line2)',
                }}
              >
                {BILLING_SUB.map(({ to: subTo, label: subLabel, end }) => (
                  <NavLink
                    key={subTo}
                    to={subTo}
                    end={end}
                    style={({ isActive }) => ({
                      padding: '7px 10px',
                      borderRadius: 7,
                      font: '500 13px/1 var(--font-sans)',
                      textDecoration: 'none',
                      background: isActive ? 'var(--b-chip)' : 'transparent',
                      color: isActive ? 'var(--b-tx)' : 'var(--b-tx2)',
                    })}
                  >
                    {subLabel}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div
        style={{
          marginTop: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '10px 12px',
          border: '1px solid var(--b-line)',
          borderRadius: 10,
          background: 'var(--b-bg)',
        }}
      >
        <Mono style={{ font: '500 12px/1 var(--font-mono)', color: 'var(--b-tx)' }} title={s.email ?? s.address ?? undefined}>
          {key}
        </Mono>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NetworkPill />
          <span style={{ flex: 1 }} />
          <ThemeToggle size={30} />
        </div>
      </div>
    </aside>
  );
}

/** Top strip of the content column: the Sign-out control, right-aligned. */
function TopBar() {
  const s = useSession();
  if (s.devView) return <div style={{ minHeight: 8 }} />;
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', minHeight: 40 }}>
      <Btn variant="outline" size="sm" onClick={s.signOut}>
        Sign out
      </Btn>
    </div>
  );
}

// ── mobile: sidebar collapses to a top bar ───────────────────────────────────
function MobileHeader() {
  const s = useSession();
  const key = short(s.account ?? s.lastAccount);
  const address = s.address ? short(s.address) : null;

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
          gridTemplateColumns: `repeat(${TABS.length},minmax(0,1fr))`,
          border: '1px solid var(--b-line)',
          borderRadius: 999,
          padding: 3,
          background: 'var(--b-card)',
        }}
      >
        {TABS.map(({ to, label }) => (
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

/**
 * Low-balance banner (billing): `low` when the runway is under ~7 days and auto
 * top-up is off. Renders nothing until bills + balance + profile have loaded, so
 * a cell with no billing backend (or a developer with no billing data) shows no
 * banner. Ported from the billing-console shell.
 */
function Banners() {
  const s = useSession();
  const navigate = useNavigate();
  const bills = useBills(s.account);
  const balance = useBalance(s.account);
  const profile = useProfile(s.account);
  if (!bills.data || balance.data == null || !profile.data) return null;

  const autoOn = profile.data.auto_recharge_threshold_usd != null;
  const days = runway(balance.data, burnPerDay(bills.data)).days;
  if (autoOn || days >= 7) return null;

  return (
    <Alert
      tone="warn"
      action={
        <>
          <Btn variant="banner" size="xs" onClick={() => navigate('/billing/payments#auto-top-up')}>
            Turn on auto top-up
          </Btn>
          <Btn variant="primary" size="xs" onClick={() => navigate('/billing/payments#top-up')}>
            Top up
          </Btn>
        </>
      }
    >
      Your balance covers {days < 1 ? 'less than a day' : `about ${Math.round(days)} day${Math.round(days) === 1 ? '' : 's'}`}. Top up or turn on auto top-up.
    </Alert>
  );
}

/**
 * App shell. Desktop: a left sidebar (primary tabs + Billing's secondary nav)
 * beside the content column. Mobile: the sidebar collapses to a top bar, and the
 * tabs become a pill row. Only the layout differs — both render the same pages.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const mobile = useIsMobile();

  if (mobile) {
    return (
      <div style={{ background: 'var(--b-bg)', color: 'var(--b-tx)', padding: '0 16px 48px', minHeight: '100vh' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <MobileHeader />
          <Banners />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--b-bg)', color: 'var(--b-tx)', minHeight: '100vh' }}>
      <div
        style={{
          maxWidth: 1240,
          margin: '0 auto',
          padding: '12px 16px 48px',
          display: 'grid',
          gridTemplateColumns: '236px minmax(0,1fr)',
          alignItems: 'start',
        }}
      >
        <Sidebar />
        <main style={{ minWidth: 0, padding: '0 0 0 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <TopBar />
          <Banners />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>{children}</div>
        </main>
      </div>
    </div>
  );
}
