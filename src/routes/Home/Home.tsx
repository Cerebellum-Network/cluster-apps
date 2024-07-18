import { observer } from 'mobx-react-lite';
import { ActivityAppIcon, Box, CdnAppIcon, StorageAppIcon, Typography } from '@developer-console/ui';

import { HomeLayout, Navigation, Sidebar, NavigationItemProps } from '~/components';

const navItems: NavigationItemProps[] = [
  {
    active: true,
    title: 'Content Storage',
    description: `Store your app's data securely across a decentralized network and maintain complete control over your data sovereignty`,
    icon: <StorageAppIcon fontSize="large" />,
  },
  {
    title: 'Content Delivery',
    description: `Deliver content with low latency and high transfer speeds`,
    icon: <CdnAppIcon fontSize="large" />,
  },
  {
    title: 'Customer Data Platform',
    description: `Store user sessions data to get insights and trigger appropriate scenarios`,
    icon: <ActivityAppIcon fontSize="large" />,
  },
];

const Home = () => {
  return (
    <HomeLayout rightElement={<Navigation items={navItems} />} leftElement={<Sidebar />}>
      <Box height={600}>
        <Typography>Home page content...</Typography>
      </Box>
    </HomeLayout>
  );
};

export default observer(Home);
