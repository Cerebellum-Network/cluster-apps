import { createHashRouter, RouterProvider } from 'react-router-dom';

import { App } from './App';
import { AccessList } from './AccessList';
import { Login } from './Login';

/**
 * The router configuration for the app.
 */
// TODO: Use createBrowserRouter instead of createHashRouter when the app is hosted on a server that supports client-side routing.
// const router = createBrowserRouter([
const router = createHashRouter([
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
