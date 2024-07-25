import {
  RightArrowIcon,
  BarTrackingIcon,
  CloudFlashIcon,
  DecentralizedServerIcon,
  Stack,
  Typography,
} from '@developer-console/ui';
import { observer } from 'mobx-react-lite';

import { useEffect } from 'react';
import { OnboardingLayout } from '~/components';
import { useAccountStore, useOnboardingStore } from '~/hooks';
import NavigationItem from './NavigationItem';
import { GoogleAnalyticsId } from '~/gtm.ts';

const Onboarding = () => {
  const store = useOnboardingStore();
  const accountStore = useAccountStore();

  useEffect(() => {
    if (accountStore.address) {
      store.startOnboarding();
    }
  }, [store, accountStore.address]);

  return (
    <OnboardingLayout singleColumn>
      <Typography variant="subtitle1">🎉 All Done!</Typography>
      <Typography variant="h3" fontWeight="bold" textAlign="center" sx={{ mb: 10, mt: 3 }}>
        What will you build with Developer Console?
      </Typography>
      <Stack gap={2} width="100%">
        <Stack width="100%" direction="row" gap={2}>
          <NavigationItem href="/" className={GoogleAnalyticsId.buildStorageBtn} icon={<CloudFlashIcon />}>
            Store my app files in the cloud
          </NavigationItem>
          <NavigationItem href="/" className={GoogleAnalyticsId.buildDeliverBtn} icon={<DecentralizedServerIcon />}>
            Deliver content globally without a central server
          </NavigationItem>
        </Stack>
        <Stack width="100%" direction="row" gap={2}>
          <NavigationItem href="/" className={GoogleAnalyticsId.buildAnalyzeBtn} icon={<BarTrackingIcon />}>
            Track App Activity and analyze user bahavior
          </NavigationItem>
          <NavigationItem smallIcon href="/" className={GoogleAnalyticsId.buildSkipBtn} icon={<RightArrowIcon />}>
            Skip this, and I'll explore it myself
          </NavigationItem>
        </Stack>
      </Stack>
    </OnboardingLayout>
  );
};

export default observer(Onboarding);
