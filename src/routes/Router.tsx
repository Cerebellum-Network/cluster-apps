import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { App } from './App';
import { Onboarding } from './Onboarding';
import { Home } from './Home';
import { Login } from './Login';

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
        path: 'Login',
        Component: Login,
      },
      {
        path: 'onboarding',
        Component: Onboarding,
      },
    ],
  },
]);

export const Router = () => <RouterProvider router={router} />;
