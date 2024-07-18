import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { App } from './App';
import { Onboarding } from './Onboarding';
import { Home } from './Home';

/**
 * The router configuration for the app.
 */
const router = createBrowserRouter([
  {
    path: '/',
    Component: App,
    children: [
      {
        index: true,
        Component: Home,
      },
      {
        path: 'onboarding',
        Component: Onboarding,
      },
    ],
  },
]);

export const Router = () => <RouterProvider router={router} />;
