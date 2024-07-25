import { observer } from 'mobx-react-lite';
import { AnalyticsId } from '@developer-console/analytics';
import {
  RightArrowIcon,
  BarTrackingIcon,
  CloudFlashIcon,
  DecentralizedServerIcon,
  Stack,
  Typography,
} from '@developer-console/ui';

import { OnboardingLayout } from '~/components';
import NavigationItem from './NavigationItem';

const Onboarding = () => (
  <OnboardingLayout singleColumn>
    <Typography variant="subtitle1">🎉 All Done!</Typography>
    <Typography variant="h3" fontWeight="bold" textAlign="center" sx={{ mb: 10, mt: 3 }}>
      What will you build with Developer Console?
    </Typography>

    <Stack gap={2} width="100%">
      <Stack width="100%" direction="row" gap={2}>
        <NavigationItem href="/content-storage" className={AnalyticsId.buildStorageBtn} icon={<CloudFlashIcon />}>
          Store my app files in the cloud
        </NavigationItem>

        <NavigationItem
          href="/content-delivery"
          className={AnalyticsId.buildDeliverBtn}
          icon={<DecentralizedServerIcon />}
        >
          Deliver content globally without a central server
        </NavigationItem>
      </Stack>

      <Stack width="100%" direction="row" gap={2}>
        <NavigationItem href="/activity-capture" className={AnalyticsId.buildAnalyzeBtn} icon={<BarTrackingIcon />}>
          Track App Activity and analyze user behavior
        </NavigationItem>
        <NavigationItem smallIcon href="/" className={AnalyticsId.buildSkipBtn} icon={<RightArrowIcon />}>
          Skip this, and I'll explore it myself
        </NavigationItem>
      </Stack>
    </Stack>
  </OnboardingLayout>
);

export default observer(Onboarding);
