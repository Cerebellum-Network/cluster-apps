import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { App } from './App';
import { Onboarding } from './Onboarding';
import { Home } from './Home';
import ContentStorage from '~/routes/ContentStorage/ContentStorage.tsx';

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
      {
        path: '/content-storage',
        Component: ContentStorage,
      },
    ],
  },
]);

export const Router = () => <RouterProvider router={router} />;
