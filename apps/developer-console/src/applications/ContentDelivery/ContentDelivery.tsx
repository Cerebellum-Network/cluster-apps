import { useCallback, useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  Paper,
  Stack,
  Typography,
  BucketSelect,
  BucketAccess,
  BucketAccessProps,
  LoadingButton,
  useMessages,
  Button,
  GithubLogoIcon,
  MetricsChart,
} from '@cluster-apps/ui';

import { GITHUB_TOKEN_BASED_CONTROL_GUIDE_LINK } from './docs';
import { useAccount } from '~/hooks';

const ContentDelivery = () => {
  const account = useAccount();
  const { showMessage } = useMessages();
  const [isSaving, setSaving] = useState(false);
  const [bucketId, setBucketId] = useState<bigint>();
  const [access, setAccess] = useState<BucketAccessProps['value']>();
  const currentBucket = account.buckets.find((bucket) => bucket.id === bucketId) || account.buckets.at(0);
  const currentBucketAccess = access || (currentBucket?.isPublic ? 'public' : 'private');

  const handleSaveAccess = useCallback(async () => {
    if (!currentBucket) {
      return;
    }

    setSaving(true);
    await account.saveBucket(currentBucket.id, { isPublic: currentBucketAccess === 'public' });

    setSaving(false);
    showMessage({ message: 'Bucket access has been saved', appearance: 'success' });
  }, [account, currentBucket, currentBucketAccess, showMessage]);

  return (
    <Stack spacing={2}>
      <Typography variant="h4">Content Delivery</Typography>

      <Paper component={Stack} direction="row" alignItems="center" justifyContent="space-between" padding={2}>
        <Typography variant="h4">Please select one of your buckets</Typography>
        <BucketSelect
          value={bucketId}
          label="Bucket"
          options={account.buckets.map((bucket) => ({ ...bucket, storedBytes: bucket.stats?.storedBytes }))}
          onChange={(bucketId) => setBucketId(bucketId)}
        />
      </Paper>

      {!!bucketId && (
        <>
          <Typography variant="h4">Bucket ID: {`${bucketId}`} CDN Options</Typography>

          <Paper component={Stack} padding={2} spacing={2}>
            <Typography variant="subtitle1">File Access Control</Typography>
            <BucketAccess
              value={currentBucketAccess}
              onChange={(value) => setAccess(value)}
              guideButton={
                <Button
                  variant="contained"
                  color="secondary"
                  href={GITHUB_TOKEN_BASED_CONTROL_GUIDE_LINK}
                  startIcon={<GithubLogoIcon />}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in Github
                </Button>
              }
            />

            <LoadingButton
              size="large"
              variant="contained"
              loading={isSaving}
              onClick={handleSaveAccess}
              sx={{ width: 150, alignSelf: 'flex-start' }}
            >
              Save
            </LoadingButton>
          </Paper>
          <MetricsChart history={account.metrics?.history} />
        </>
      )}
    </Stack>
  );
};

export default observer(ContentDelivery);
