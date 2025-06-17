import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { Navigate, Outlet, useMatch } from 'react-router-dom';
import { Box, LoadingAnimation, Paper, styled } from '@cluster-apps/ui';

import { useAppStore } from '~/hooks';
import { Layout } from '~/components';
/**
 * TODO: Figure out how to properly size such animation components
 */
const Loading = styled(LoadingAnimation)({
  width: 200,
  height: 200,
});

const App = () => {
  const appStore = useAppStore();

  const isOnLogin = !!useMatch('/login');
  const isLoggedIn = appStore.accountStore.isReady();
  const isReady = appStore.isReady;

  useEffect(() => {
    appStore.init();
  }, [appStore]);

  if (isReady && !isOnLogin && !isLoggedIn) {
    return <Navigate to="/login" />;
  }

  if (isReady && isOnLogin && isLoggedIn) {
    return <Navigate to="/" />;
  }

  if (appStore.isReady) {
    return <Outlet />;
  }

  return (
    <Layout>
      <Paper>
        <Box height="80vh" display="flex" justifyContent="center" alignItems="center">
          <Loading />
        </Box>
      </Paper>
    </Layout>
  );
};

export default observer(App);
