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
