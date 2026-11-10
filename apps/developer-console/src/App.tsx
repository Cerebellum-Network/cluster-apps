import { lazy, Suspense, useEffect, useMemo } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { AppShell } from './layout/AppShell';
import { short } from './lib/format';
import { SignIn } from './pages/SignIn';
import { billingTheme } from './theme/muiTheme';
import { ThemeModeProvider, useThemeMode } from './theme/ThemeMode';
import { SessionProvider, useSession } from './wallet/session';
import { MessageCard } from './components/ui';

// Code-split the feature tabs: they pull the DDC + AWS S3 SDKs, which must not
// weigh down the main bundle. Loaded only when their route is opened.
const StoragePage = lazy(() => import('./storage/StoragePage').then((m) => ({ default: m.StoragePage })));
const ModelsPage = lazy(() => import('./models/ModelsPage').then((m) => ({ default: m.ModelsPage })));
// Billing tab (Phase 3): the whole billing slice is one chunk; it pulls the
// Manykind-boundary clients (reconciliation / payment / orchestrator).
const BillingSection = lazy(() => import('./billing/BillingSection'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeModeProvider>
        <Themed />
      </ThemeModeProvider>
    </QueryClientProvider>
  );
}

function Themed() {
  const { mode } = useThemeMode();
  const theme = useMemo(() => billingTheme(mode), [mode]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <SessionProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/sign-in" element={<SignInRoute />} />
            <Route element={<Authenticated />}>
              <Route
                path="/storage"
                element={
                  <Suspense fallback={<div style={{ padding: 24, color: 'var(--b-tx2)' }}>Loading…</div>}>
                    <StoragePage />
                  </Suspense>
                }
              />
              <Route
                path="/models"
                element={
                  <Suspense fallback={<div style={{ padding: 24, color: 'var(--b-tx2)' }}>Loading…</div>}>
                    <ModelsPage />
                  </Suspense>
                }
              />
              <Route
                path="/billing/*"
                element={
                  <Suspense fallback={<div style={{ padding: 24, color: 'var(--b-tx2)' }}>Loading…</div>}>
                    <BillingSection />
                  </Suspense>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/storage" replace />} />
          </Routes>
        </BrowserRouter>
      </SessionProvider>
    </ThemeProvider>
  );
}

/** New page, top of the page — unless the link targets a section (#top-up). */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

function SignInRoute() {
  const s = useSession();
  const location = useLocation();
  if (s.state === 'connected') {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/sign-in' ? from : '/storage'} replace />;
  }
  return <SignIn />;
}

/**
 * The app shell routes. Without a wallet session they go to /sign-in (and
 * come back afterwards); an expired session keeps the shell and shows the
 * reconnect state in place of every page.
 */
function Authenticated() {
  const s = useSession();
  const location = useLocation();
  if (s.state === 'connected') {
    return (
      <AppShell>
        <Outlet />
      </AppShell>
    );
  }
  if (s.state === 'expired') {
    return (
      <AppShell>
        <MessageCard
          glyph="·"
          iconBg="var(--b-acc-soft)"
          iconTx="var(--b-acc-tx)"
          title="Wallet session expired"
          body={`Reconnect your wallet to keep using the console for ${short(s.lastAccount) || 'this account'}.`}
          cta="Reconnect your wallet"
          onCta={s.connect}
        />
      </AppShell>
    );
  }
  return <Navigate to="/sign-in" replace state={{ from: location.pathname + location.search + location.hash }} />;
}
