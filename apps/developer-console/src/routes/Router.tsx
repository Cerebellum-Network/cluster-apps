import { createBrowserRouter, Navigate, RouteObject, RouterProvider } from 'react-router-dom';

import applications, { Application } from '~/applications';

import { App } from './App';
import { Home } from './Home';
import { Login } from './Login';
import { TopUp } from './TopUp';

export type ApplicationHandle = Omit<Application, 'rootComponent' | 'rootPath'>;

const [defaultApp] = applications;
// Apps with sub-navigation (e.g. Inference → Models/Quickstart/API keys) host
// their own nested <Routes>, so their route must be a splat. The `/` index child
// below redirects to the default app, so no app route is itself an index route.
const mapAppToRoute = ({ rootComponent, rootPath, ...handle }: Application): RouteObject => ({
  path: handle.subNav?.length ? `${rootPath}/*` : rootPath,
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
        children: [
          {
            index: true,
            element: <Navigate replace to={defaultApp.rootPath} />,
          },
          {
            path: 'top-up',
            Component: TopUp,
          },
          ...applications.map(mapAppToRoute),
        ],
      },
      {
        path: 'login',
        Component: Login,
      },
    ],
  },
]);

export const Router = () => <RouterProvider router={router} />;
