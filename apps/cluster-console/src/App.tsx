import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from 'react-router-dom';
import { Provider as UIProvider } from '@cluster-apps/ui';
import { CircularProgress, GlobalStyles, Stack, ThemeProvider } from '@mui/material';
import { developerConsoleTheme } from '@cluster-apps/developer-console/src/theme';
import { color } from '@cluster-apps/developer-console/src/theme/tokens';

import { Shell } from '~/components/Shell';
import { Egress } from '~/pages/Egress';
import { Inference } from '~/pages/Inference';
import { Login } from '~/pages/Login';
import { Nodes } from '~/pages/Nodes';
import { Overview } from '~/pages/Overview';
import { Placements } from '~/pages/Placements';
import { Revenue } from '~/pages/Revenue';
import { Sandboxes } from '~/pages/Sandboxes';
import { SandboxesService } from '~/pages/SandboxesService';
import { MissingScreen, Sources } from '~/pages/Sources';
import { Usage } from '~/pages/Usage';
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
          { path: 'revenue', element: <Revenue /> },
          { path: 'inference', element: <Inference /> },
          {
            // A service, with its tabs.
            path: 'sandboxes',
            element: <SandboxesService />,
            children: [
              { index: true, element: <Sandboxes /> },
              { path: 'placements', element: <Placements /> },
              { path: 'egress', element: <Egress /> },
              { path: 'usage', element: <Usage /> },
            ],
          },
          // Earlier addresses of the sandbox tabs and of screens that moved.
          { path: 'placements', element: <Moved to="/sandboxes/placements" /> },
          { path: 'egress', element: <Moved to="/sandboxes/egress" /> },
          { path: 'usage', element: <Moved to="/sandboxes/usage" /> },
          { path: 'missing/revenue', element: <Moved to="/revenue" /> },
          { path: 'missing/provider-join', element: <Moved to="/missing/requests" /> },
          { path: 'sources', element: <Sources /> },
          { path: 'missing/:screen', element: <MissingScreen /> },
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
        <GlobalStyles styles={{ body: { background: color.page } }} />
        <SessionProvider>
          <RouterProvider router={router} />
        </SessionProvider>
      </ThemeProvider>
    </UIProvider>
  );
}
