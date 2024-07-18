import { observer } from 'mobx-react-lite';
import { Typography, Layout } from '@developer-console/ui';

const Home = () => {
  return (
    <Layout disablePaddings fullPage headerRight={<Typography>Account</Typography>}>
      <Typography>Home page content...</Typography>
    </Layout>
  );
};

export default observer(Home);
