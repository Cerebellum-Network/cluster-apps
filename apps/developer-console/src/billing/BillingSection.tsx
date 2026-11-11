import { NavLink, Route, Routes } from 'react-router-dom';
import { useIsMobile } from '../lib/useIsMobile';
import { Overview } from './Overview';
import { BillsList } from './bills/BillsList';
import { BillDetail } from './bills/BillDetail';
import { Payments } from './payments/Payments';

/**
 * The Billing tab (Phase 3 -- billing-console folded in as one tab). Mounted at
 * `/billing/*` by App.tsx over its own nested routes, so the whole billing slice
 * is one code-split chunk behind a single top-level route. All billing calls
 * (reconciliation / payment / orchestrator) live under this slice -- the Manykind
 * boundary, kept in one place.
 *
 * The secondary nav (Overview / Bills / Payments) lives in the left sidebar on
 * desktop (AppShell), where it nests under the Billing entry. On mobile the
 * sidebar collapses to a pill row of the primary tabs only, so the slice renders
 * its own secondary nav inline there.
 */
const SUB = [
  { to: '/billing', label: 'Overview', end: true },
  { to: '/billing/bills', label: 'Bills', end: false },
  { to: '/billing/payments', label: 'Payments', end: false },
] as const;

function SubNav() {
  return (
    <nav style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {SUB.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          style={({ isActive }) => ({
            padding: '6px 12px',
            borderRadius: 999,
            font: '500 13px/1 var(--font-sans)',
            textDecoration: 'none',
            background: isActive ? 'var(--b-card)' : 'transparent',
            border: `1px solid ${isActive ? 'var(--b-line)' : 'transparent'}`,
            color: isActive ? 'var(--b-tx)' : 'var(--b-tx2)',
          })}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function BillingSection() {
  const mobile = useIsMobile();
  return (
    <>
      {mobile && <SubNav />}
      <Routes>
        <Route index element={<Overview />} />
        <Route path="bills" element={<BillsList />} />
        <Route path="bills/:period" element={<BillDetail />} />
        <Route path="payments" element={<Payments />} />
      </Routes>
    </>
  );
}
