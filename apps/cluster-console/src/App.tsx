import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from 'react-router-dom';
import { Provider as UIProvider } from '@cluster-apps/ui';
import { CircularProgress, GlobalStyles, Stack, ThemeProvider } from '@mui/material';
import { developerConsoleTheme } from '@cluster-apps/developer-console/src/theme';
import { color } from '@cluster-apps/developer-console/src/theme/tokens';

import { Shell } from '~/components/Shell';
import { Customers } from '~/pages/Customers';
import { Delivery } from '~/pages/Delivery';
import { Egress } from '~/pages/Egress';
import { Inference } from '~/pages/Inference';
import { Login } from '~/pages/Login';
import { Nodes } from '~/pages/Nodes';
import { Overview } from '~/pages/Overview';
import { Revenue } from '~/pages/Revenue';
import { SandboxList } from '~/pages/SandboxList';
import { SandboxesService } from '~/pages/SandboxesService';
import { Sources } from '~/pages/Sources';
import { Storage } from '~/pages/Storage';
import { SessionProvider, useSession } from '~/session/SessionProvider';

/** Pages need a backend session; without one, sign in and come back. */
function RequireSession() {
  const s = useSession();
  const location = useLocation();
  if (s.restoring) {
    return (
      <Stack minHeight="100vh" alignItems="center" justifyContent="center">
        <CircularProgress size={28} aria-label="Checking your session" />
      </Stack>
    );
  }
  if (!s.info) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

/** Keeps an old link working: same filters, new place. */
function Moved({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={to + search} replace />;
}

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <RequireSession />,
    children: [
      {
        element: <Shell />,
        children: [
          { index: true, element: <Overview /> },
          { path: 'nodes', element: <Nodes /> },
          { path: 'customers', element: <Customers /> },
          { path: 'revenue', element: <Revenue /> },
          { path: 'storage', element: <Storage /> },
          { path: 'delivery', element: <Delivery /> },
          { path: 'inference', element: <Inference /> },
          {
            // A service: live nodes and usage on top, then its lists.
            path: 'sandboxes',
            element: <SandboxesService />,
            children: [
              { index: true, element: <SandboxList /> },
              { path: 'egress', element: <Egress /> },
              // Placements and usage records are no longer tabs: a sandbox's
              // drawer says where it runs and why; usage is the charts above.
              { path: 'placements', element: <Moved to="/sandboxes" /> },
              { path: 'usage', element: <Moved to="/sandboxes" /> },
            ],
          },
          // Earlier addresses.
          { path: 'placements', element: <Moved to="/sandboxes" /> },
          { path: 'egress', element: <Moved to="/sandboxes/egress" /> },
          { path: 'usage', element: <Moved to="/sandboxes" /> },
          { path: 'sources', element: <Sources /> },
          { path: 'missing/storage', element: <Moved to="/storage" /> },
          { path: 'missing/delivery', element: <Moved to="/delivery" /> },
          { path: 'missing/customers', element: <Moved to="/customers" /> },
          { path: 'missing/:screen', element: <Navigate to="/sources" replace /> },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return (
    <UIProvider>
      <ThemeProvider theme={developerConsoleTheme}>
        <GlobalStyles
          styles={{
            body: { background: color.page },
            '@media (prefers-reduced-motion: reduce)': {
              '*': { animation: 'none !important', transition: 'none !important' },
            },
          }}
        />
        <SessionProvider>
          <RouterProvider router={router} />
        </SessionProvider>
      </ThemeProvider>
    </UIProvider>
  );
}
