import { observer } from 'mobx-react-lite';
import { Typography, Layout } from '@developer-console/ui';

import { AccountDropdown } from '~/components';

const Home = () => (
  <Layout disablePaddings fullPage headerRight={<AccountDropdown />}>
    <Typography>Home page content...</Typography>
  </Layout>
);

export default observer(Home);
