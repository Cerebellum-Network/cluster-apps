import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { App } from './App';
import { AccessList } from './AccessList';
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
        path: '/',
        element: <AccessList />,
      },

      {
        path: '/login',
        element: <Login />,
      },
    ],
  },
]);

export const Router = () => <RouterProvider router={router} />;
