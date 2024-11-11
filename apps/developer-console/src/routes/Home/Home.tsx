import { Box, Button, DiscordButton, LoadingAnimation, styled, useOnboarding, Stack } from '@cluster-apps/ui';
import { observer } from 'mobx-react-lite';
import { Navigate, Outlet } from 'react-router-dom';

import { AnalyticsId } from '@cluster-apps/analytics';
import { Application } from '~/applications';
import { HomeLayout, Navigation, Sidebar } from '~/components';
import { useAccountStore } from '~/hooks';
import { DISCORD_LINK } from '~/constants.ts';
import { useApplicationTour } from '~/components/ApplicationTour';

export type HomeProps = {
  apps: Application[];
};

/**
 * TODO: Figure out how to properly size such animation components
 */
const Loading = styled(LoadingAnimation)({
  width: 200,
  height: 200,
});

const Home = ({ apps }: HomeProps) => {
  const account = useAccountStore();
  const { restartOnboarding } = useOnboarding();
  const { showTour } = useApplicationTour();

  if (account.status !== 'connected') {
    return <Navigate to="/login" />;
  }

  const onProductTourClick = () => {
    restartOnboarding();
    // use unknown step to start from the very beginning
    showTour('fromTheVeryBeginning');
  };

  return (
    <HomeLayout
      rightElement={
        <Navigation
          items={apps}
          footer={
            <Stack spacing={2}>
              <DiscordButton text="Join Cere Discord" link={DISCORD_LINK} className={AnalyticsId.joinDiscordBtn} />
              <Button onClick={onProductTourClick}>Product tour</Button>
            </Stack>
          }
        />
      }
      leftElement={<Sidebar />}
      headerRight={<DiscordButton text="Discord" link={DISCORD_LINK} className={AnalyticsId.joinDiscordBtn} />}
    >
      {account.isReady() ? (
        <Outlet />
      ) : (
        <Box height="100%" display="flex" justifyContent="center" alignItems="center">
          <Loading />
        </Box>
      )}
    </HomeLayout>
  );
};

export default observer(Home);
