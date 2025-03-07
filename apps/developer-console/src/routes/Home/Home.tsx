import { Box, LoadingAnimation, styled, DiscordButton } from '@cluster-apps/ui';
import { observer } from 'mobx-react-lite';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { AnalyticsId } from '@cluster-apps/analytics';
import { Application } from '~/applications';
import { HomeLayout, Sidebar } from '~/components';
import { useAccountStore } from '~/hooks';
import { DISCORD_LINK } from '~/constants.ts';

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
  const location = useLocation();

  if (account.status !== 'connected') {
    return <Navigate to="/login" />;
  }

  // Don't show sidebar for content-delivery and analytics routes
  const hideSidebar = ['/content-delivery', '/analytics'].some(path => 
    location.pathname.startsWith(path)
  );

  return (
    <HomeLayout
      navigationItems={apps}
      leftElement={!hideSidebar ? <Sidebar /> : undefined}
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
