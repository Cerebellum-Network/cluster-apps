import { observer } from 'mobx-react-lite';
import { Outlet } from 'react-router-dom';

import { Application } from '~/applications';
import { HomeLayout, Navigation, Sidebar } from '~/components';

export type HomeProps = {
  apps: Application[];
};

const Home = ({ apps }: HomeProps) => (
  <HomeLayout rightElement={<Navigation items={apps} />} leftElement={<Sidebar />}>
    <Outlet />
  </HomeLayout>
);

export default observer(Home);
