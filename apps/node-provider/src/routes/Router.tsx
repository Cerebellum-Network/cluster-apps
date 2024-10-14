import { createHashRouter, RouteObject, RouterProvider } from 'react-router-dom';

import applications, { Application } from '~/applications';

import { OnboardingRoot } from './OnboardingRoot';
import { Login } from './Login';
import { Onboarding } from './Onboarding';
import App from './App/App.tsx';
import { Home } from './Home';

export type ApplicationHandle = Omit<Application, 'rootComponent' | 'rootPath'>;
const [defaultApp] = applications;
const mapAppToRoute = ({ rootComponent, rootPath, ...handle }: Application, index: number): RouteObject => ({
  index: index === 0,
  path: rootPath,
  Component: rootComponent,
  handle,
});

const router = createHashRouter([
  {
    path: '/',
    Component: App,
    children: [
      {
        path: '/',
        element: <Home apps={applications} />,
      },
      ...applications.map(mapAppToRoute),
    ],
  },
  {
    path: 'login',
    element: <OnboardingRoot />,
    children: [
      {
        index: true,
        element: <Login />,
      },
      {
        path: 'onboarding',
        element: <Onboarding />,
      },
    ],
  },
]);

export const Router = () => <RouterProvider router={router} />;
