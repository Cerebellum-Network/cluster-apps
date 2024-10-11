import { createHashRouter, RouterProvider } from 'react-router-dom';
import { OnboardingRoot } from './OnboardingRoot';
import { Login } from './Login';
import { Onboarding } from './Onboarding';
import App from './App/App.tsx';
import { Home } from './Home';

const router = createHashRouter([
  {
    path: '/',
    Component: App,
    children: [
      {
        path: '/',
        element: <Home apps={[]} />,
      },
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
