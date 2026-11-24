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
import { Sandboxes } from '~/pages/Sandboxes';
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
          { path: 'sandboxes', element: <Sandboxes /> },
          { path: 'placements', element: <Placements /> },
          { path: 'egress', element: <Egress /> },
          { path: 'usage', element: <Usage /> },
          { path: 'inference', element: <Inference /> },
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
