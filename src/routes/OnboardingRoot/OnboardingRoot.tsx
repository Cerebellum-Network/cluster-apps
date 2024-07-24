import { Outlet } from 'react-router-dom';
import { Button, DiscordIcon, Layout, Stack } from '@developer-console/ui';
import { GoogleAnalyticsId } from '~/gtag.ts';

const OnboardingRoot = () => {
  return (
    <Layout
      headerRight={
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" color="secondary">
            Developer Docs
          </Button>

          <Button startIcon={<DiscordIcon />} className={GoogleAnalyticsId.joinDiscordBtn}>
            Discord
          </Button>
        </Stack>
      }
    >
      <Outlet />
    </Layout>
  );
};

export default OnboardingRoot;
