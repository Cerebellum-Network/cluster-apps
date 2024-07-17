import { RouterProvider, createHashRouter } from 'react-router-dom';
import { Onboarding } from './Onboarding';
import { Home } from './Home';

/**
 * The router configuration for the app.
 *
 * TODO: use `createBrowserRouter` instead of createHashRouter when DevOps configures the server to handle client-side routing.
 */
const router = createHashRouter([
  {
    path: '/',
    children: [
      {
        index: true,
        Component: Onboarding,
      },
      {
        path: 'home',
        Component: Home,
      },
    ],
  },
]);

export const Router = () => <RouterProvider router={router} />;
