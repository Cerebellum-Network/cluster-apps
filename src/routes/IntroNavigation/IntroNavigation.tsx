import {
  RightArrowIcon,
  BarTrackingIcon,
  Button,
  CloudFlashIcon,
  DecentralizedServerIcon,
  Stack,
  Typography,
} from '@developer-console/ui';
import { observer } from 'mobx-react-lite';

import { useEffect } from 'react';
import { OnboardingLayout } from '~/components';
import { DiscordIcon, Layout } from '@developer-console/ui';
import { useAccountStore, useOnboardingStore } from '~/hooks';
import NavigationItem from './NavigationItem';
import { useTheme } from '@mui/material';

const Onboarding = () => {
  const store = useOnboardingStore();
  const accountStore = useAccountStore();

  const theme = useTheme();

  useEffect(() => {
    if (accountStore.address) {
      store.startOnboarding();
    }
  }, [store, accountStore.address]);

  return (
    <Layout
      headerRight={
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" color="secondary">
            Developer Docs
          </Button>

          <Button startIcon={<DiscordIcon />}>Discord</Button>
        </Stack>
      }
    >
      <OnboardingLayout singleColumn>
        <Typography variant="h6">🎉 All Done!</Typography>
        <Typography variant="h3" fontWeight="bold" textAlign="center" sx={{ mb: 10, mt: 3 }}>
          What will you build with Developer Console?
        </Typography>
        <Stack gap={2} width="100%">
          <Stack width="100%" direction="row" gap={2}>
            <NavigationItem href="#" icon={<CloudFlashIcon />}>
              Store my app files in the cloud
            </NavigationItem>
            <NavigationItem href="#" icon={<DecentralizedServerIcon />}>
              Deliver content globally without a central server
            </NavigationItem>
          </Stack>
          <Stack width="100%" direction="row" gap={2}>
            <NavigationItem href="#" icon={<BarTrackingIcon />}>
              Store my app files in the cloud
            </NavigationItem>
            <NavigationItem href="#" icon={<RightArrowIcon fill={theme.palette.primary.main} />}>
              Deliver content globally without a central server
            </NavigationItem>
          </Stack>
        </Stack>
      </OnboardingLayout>
    </Layout>
  );
};

export default observer(Onboarding);
