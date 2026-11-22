import { Box, Button, DiscordButton, LoadingAnimation, styled, Stack } from '@cluster-apps/ui';
import { observer } from 'mobx-react-lite';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { AnalyticsId } from '@cluster-apps/analytics';
import { Application } from '~/applications';
import { HomeLayout, Navigation } from '~/components';
import { useAccountStore } from '~/hooks';
import { DISCORD_LINK, DEVELOPER_DOCS_LINK } from '~/constants.ts';
import { useSession } from '~/wallet/session';
import { homeGate, type LoginState } from '../authGate';

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
  const session = useSession();
  const account = useAccountStore();
  const location = useLocation();

  // The gate reads the session itself: SessionBridge copies it into the store
  // in an effect, one render behind, so the store alone reads "signed out" for
  // a moment on every load. The shell (whose header reads the account) still
  // waits for the store to catch up.
  const gate = homeGate(session);
  if (gate === 'wait' || (gate === 'app' && !account.isReady())) {
    return (
      <Box height="100vh" display="flex" justifyContent="center" alignItems="center" role="progressbar" aria-label="Signing you in">
        <Loading />
      </Box>
    );
  }
  if (gate === 'login') {
    return <Navigate to="/login" replace state={{ from: location } satisfies LoginState} />;
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
      <Outlet />
    </HomeLayout>
  );
};

export default observer(Home);
