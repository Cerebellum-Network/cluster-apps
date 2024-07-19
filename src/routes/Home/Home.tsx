import { observer } from 'mobx-react-lite';
import { Outlet, Navigate } from 'react-router-dom';

import { Application } from '~/applications';
import { HomeLayout, Navigation, Sidebar } from '~/components';
import { useAccountStore } from '~/hooks';

export type HomeProps = {
  apps: Application[];
};

const Home = ({ apps }: HomeProps) => {
  const account = useAccountStore();

  if (account.status !== 'connected') {
    return <Navigate to="/login" />;
  }

  return (
    <HomeLayout rightElement={<Navigation items={apps} />} leftElement={<Sidebar />}>
      <Outlet />
    </HomeLayout>
  );
};

export default observer(Home);
