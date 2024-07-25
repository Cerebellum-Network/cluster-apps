import { Outlet } from 'react-router-dom';
import { Button, DiscordIcon, Stack } from '@developer-console/ui';
import { GoogleAnalyticsId } from '~/gtm.ts';

import { DEVELOPER_DOCS_LINK, DISCORD_LINK } from '~/constants.ts';
import { Layout } from '~/components';

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
            className={GoogleAnalyticsId.joinDiscordBtn}
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
