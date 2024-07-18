import { observer } from 'mobx-react-lite';
import { Box, Typography } from '@developer-console/ui';

import { HomeLayout } from '~/components';

const Home = () => (
  <HomeLayout>
    <Box height={600}>
      <Typography>Home page content...</Typography>
    </Box>
  </HomeLayout>
);

export default observer(Home);
