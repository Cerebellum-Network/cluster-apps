import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, Outlet } from 'react-router-dom';
import { Box, LoadingAnimation, Paper, styled, Typography, Container } from '@developer-console/ui';

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
  const [isServiceAvailable, setIsServiceAvailable] = useState<boolean | null>(null);
  const appStore = useAppStore();

  useEffect(() => {
    const checkServiceAvailability = async () => {
      try {
        const response = await fetch('https://wallet.core.aws.cere.io');
        setIsServiceAvailable(response.ok);
      } catch {
        setIsServiceAvailable(false);
      }
    };

    checkServiceAvailability();
  }, []);

  useEffect(() => {
    appStore.init();
  }, [appStore]);

  if (appStore.isReady) {
    return <Outlet />;
  }

  return (
    <Layout>
      <Paper>
        {!isServiceAvailable ? (
          <Container maxWidth="sm">
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '80vh',
                textAlign: 'center',
              }}
            >
              <Typography variant="h4" gutterBottom>
                Thank you for using our developer console.
              </Typography>
              <Typography variant="body1" paragraph>
                Currently we are applying an important update. Our apologies for any inconvenience this may cause. You
                can expect the developer console to be available again shortly.
              </Typography>
              <Typography variant="body1" paragraph>
                If you have any questions, don't hesitate to reach out on{' '}
                <Link to="https://discord.gg/8RBXaQ6nT5" target="_blank" rel="noopener">
                  Discord
                </Link>
                .
              </Typography>
              <Typography variant="body1" paragraph align="left">
                Cere Team
              </Typography>
            </Box>
          </Container>
        ) : (
          <Box height="80vh" display="flex" justifyContent="center" alignItems="center">
            <Loading />
          </Box>
        )}
      </Paper>
    </Layout>
  );
};

export default observer(App);
