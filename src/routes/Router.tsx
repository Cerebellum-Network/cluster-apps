import { createBrowserRouter, RouteObject, RouterProvider } from 'react-router-dom';

import applications, { Application } from '~/applications';

import { App } from './App';
import { Onboarding } from './Onboarding';
import { Home } from './Home';

export type ApplicationHandle = Omit<Application, 'rootComponent' | 'rootPath'>;
const mapAppToRoute = ({ rootComponent, rootPath, ...handle }: Application): RouteObject => ({
  path: rootPath,
  Component: rootComponent,
  handle,
});

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
        element: <Home apps={applications} />,
        children: applications.map(mapAppToRoute),
      },
      {
        path: 'onboarding',
        Component: Onboarding,
      },
    ],
  },
]);

export const Router = () => <RouterProvider router={router} />;
