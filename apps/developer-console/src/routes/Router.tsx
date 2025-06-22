import { createBrowserRouter, Navigate, RouteObject, RouterProvider, Route, Routes } from 'react-router-dom';

import applications, { Application } from '~/applications';

import { App } from './App';
import { Onboarding } from './Onboarding';
import { Home } from './Home';
import { Login } from './Login';
import { OnboardingRoot } from './OnboardingRoot';
import { TopUp } from './TopUp';
import { TopUpWithCard } from './TopUpWithCard';
import { Success } from './Success/Success';
import { Cancel } from './Cancel/Cancel';
import DepositFromWallet from './DepositFromWallet/DepositFromWallet';

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
          {
            path: 'top-up',
            Component: TopUp,
          },
          {
            path: 'top-up-card',
            Component: TopUpWithCard,
          },
          {
            path: 'success',
            Component: Success,
          },
          {
            path: 'cancel',
            Component: Cancel,
          },
          {
            path: 'deposit-from-wallet',
            Component: DepositFromWallet,
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
    ],
  },
]);

export const Router = () => <RouterProvider router={router} />;
