import { Box, Button, DiscordButton, LoadingAnimation, styled, Stack } from '@cluster-apps/ui';
import { observer } from 'mobx-react-lite';
import { Navigate, Outlet } from 'react-router-dom';

import { AnalyticsId } from '@cluster-apps/analytics';
import { Application } from '~/applications';
import { HomeLayout, Navigation } from '~/components';
import { useAccountStore } from '~/hooks';
import { DISCORD_LINK, DEVELOPER_DOCS_LINK } from '~/constants.ts';

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
      // "Product tour" is not in the mockup (#192 review), so the sidebar has no footer.
      rightElement={<Navigation items={apps} />}
      headerRight={
        <Stack direction="row" spacing={1} alignItems="center">
          <Button variant="text" color="secondary" component="a" href={DEVELOPER_DOCS_LINK} target="_blank">
            Docs
          </Button>
          <DiscordButton text="Discord" link={DISCORD_LINK} className={AnalyticsId.joinDiscordBtn} />
        </Stack>
      }
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
