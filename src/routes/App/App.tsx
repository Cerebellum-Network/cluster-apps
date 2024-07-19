import { Box, CircularProgress, Layout, Paper } from '@developer-console/ui';

import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAppStore } from '~/hooks';

const App = () => {
  const appStore = useAppStore();

  useEffect(() => {
    appStore.init();
  }, [appStore]);

  if (appStore.isReady()) {
    return <Outlet />;
  }

  return (
    <Layout>
      <Paper>
        <Box height="80vh" display="flex" justifyContent="center" alignItems="center">
          {/* TODO: Replace with Lottie LoadingAnimation component */}
          <CircularProgress />
        </Box>
      </Paper>
    </Layout>
  );
};

export default observer(App);
