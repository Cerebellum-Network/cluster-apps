import { useCallback, useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  Paper,
  Docs,
  DocsGroup,
  DocsSection,
  Stack,
  Typography,
  BucketSelect,
  BucketAccess,
  BucketAccessProps,
  LoadingButton,
  useMessages,
} from '@developer-console/ui';

import { CdnDocsIcon } from './icons';
import { DDC_CLUSTER_NAME } from '~/constants';
import { StartGuideDoc, UploadWithCliDoc, StreamDoc, SuccessDoc } from './docs';

import { useAccount } from '~/hooks';

const ContentDelivery = () => {
  const account = useAccount();
  const { showMessage } = useMessages();
  const [isSaving, setSaving] = useState(false);
  const [bucketId, setBucketId] = useState<bigint>();
  const [access, setAccess] = useState<BucketAccessProps['value']>();
  const currentBucket = account.buckets.find((bucket) => bucket.id === bucketId) || account.buckets[0];
  const currentBucketAccess = access || (currentBucket?.isPublic ? 'public' : 'private');

  const handleSaveAccess = useCallback(async () => {
    setSaving(true);
    await account.saveBucket(currentBucket.id, { isPublic: currentBucketAccess === 'public' });

    setSaving(false);
    showMessage({ message: 'Bucket access has been saved', appearance: 'success' });
  }, [account, currentBucket, currentBucketAccess, showMessage]);

  return (
    <Stack spacing={2}>
      <Paper component={Stack} direction="row" alignItems="center" justifyContent="space-between" padding={2}>
        <Typography variant="subtitle1">Please select one of your buckets</Typography>
        <BucketSelect
          value={currentBucket.id}
          label="Bucket"
          options={account.buckets.map((bucket) => ({ ...bucket, storedBytes: bucket.stats?.storedBytes }))}
          onChange={(bucketId) => setBucketId(bucketId)}
        />
      </Paper>

      <Paper component={Stack} padding={2} spacing={2}>
        <Typography variant="subtitle1">File access control</Typography>
        <BucketAccess value={currentBucketAccess} onChange={(value) => setAccess(value)} />

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

      <Docs
        icon={<CdnDocsIcon />}
        title="Start streaming now with Cere!"
        description="Enjoy unparalleled speed, reliability and censorship-resistant content streaming"
      >
        <DocsGroup title="Upload your content using DDC SDK">
          <DocsSection title="Upload your content using DDC CLI">
            <UploadWithCliDoc />
          </DocsSection>

          <DocsSection title="Quick start guide in Github">
            <StartGuideDoc />
          </DocsSection>
        </DocsGroup>

        <DocsGroup title={`Stream from ${DDC_CLUSTER_NAME}`}>
          <DocsSection title="Step-by-step guide">
            <StreamDoc />
          </DocsSection>

          <DocsSection title="Success user stories">
            <SuccessDoc />
          </DocsSection>
        </DocsGroup>
      </Docs>
    </Stack>
  );
};

export default observer(ContentDelivery);
