import { Outlet } from 'react-router-dom';
import { Button, Stack } from '@developer-console/ui';

import { DEVELOPER_DOCS_LINK } from '~/constants.ts';
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
        </Stack>
      }
    >
      <Outlet />
    </Layout>
  );
};

export default OnboardingRoot;
