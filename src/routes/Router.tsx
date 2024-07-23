import { createBrowserRouter, Navigate, RouteObject, RouterProvider } from 'react-router-dom';

import applications, { Application } from '~/applications';

import { App } from './App';
import { Onboarding } from './Onboarding';
import { Home } from './Home';
import { Login } from './Login';
import { IntroNavigation } from './IntroNavigation';

export type ApplicationHandle = Omit<Application, 'rootComponent' | 'rootPath'>;

const [defaultApp] = applications;
const mapAppToRoute = ({ rootComponent, rootPath, ...handle }: Application, index: number): RouteObject => ({
  index: index === 0,
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
        children: [
          {
            index: true,
            element: <Navigate replace to={defaultApp.rootPath} />,
          },
          ...applications.map(mapAppToRoute),
        ],
      },
      {
        path: 'login',
        Component: Login,
      },
      {
        path: 'login/onboarding',
        Component: Onboarding,
      },
      {
        path: 'login/intro',
        Component: IntroNavigation,
      },
    ],
  },
]);

export const Router = () => <RouterProvider router={router} />;
