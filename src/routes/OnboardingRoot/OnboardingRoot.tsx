import { Outlet } from 'react-router-dom';
import { Button, DiscordIcon, Layout, Stack } from '@developer-console/ui';
import { AnalyticsId } from '@developer-console/analytics';

import { DEVELOPER_DOCS_LINK, DISCORD_LINK } from '~/constants.ts';

const OnboardingRoot = () => {
  return (
    <Layout
      headerRight={
        <Stack direction="row" spacing={1}>
          <Button
            href={DEVELOPER_DOCS_LINK}
            variant="outlined"
            color="secondary"
            target="_blank"
            rel="noopener noreferrer"
          >
            Developer Docs
          </Button>

          <Button
            href={DISCORD_LINK}
            startIcon={<DiscordIcon />}
            className={AnalyticsId.joinDiscordBtn}
            target="_blank"
            rel="noopener noreferrer"
          >
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
