import { Box, DiscordButton, LoadingAnimation, styled } from '@developer-console/ui';
import { observer } from 'mobx-react-lite';
import { Navigate, Outlet } from 'react-router-dom';

import { Application } from '~/applications';
import { HomeLayout, Navigation, Sidebar } from '~/components';
import { useAccountStore } from '~/hooks';
import { DISCORD_LINK } from '~/constants.ts';
import { AnalyticsId } from '@developer-console/analytics';

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

  if (account.status !== 'connected') {
    return <Navigate to="/login" />;
  }

  return (
    <HomeLayout
      rightElement={
        <Navigation
          items={apps}
          buttonElement={
            <DiscordButton text="Join Cere Discord" link={DISCORD_LINK} className={AnalyticsId.joinDiscordBtn} />
          }
        />
      }
      leftElement={<Sidebar />}
      buttonElement={<DiscordButton text="Discord" link={DISCORD_LINK} className={AnalyticsId.joinDiscordBtn} />}
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
