import { observer } from 'mobx-react-lite';
import { Outlet } from 'react-router-dom';

import { Application } from '~/applications';
import { HomeLayout, Navigation, Sidebar } from '~/components';
import { useAccountStore } from '~/hooks';

export type HomeProps = {
  apps: Application[];
};

const Home = ({ apps }: HomeProps) => {
  const account = useAccountStore();

  return (
    <HomeLayout rightElement={<Navigation items={apps} />} leftElement={<Sidebar />}>
      {account.isReady() && <Outlet />}
    </HomeLayout>
  );
};

export default observer(Home);
