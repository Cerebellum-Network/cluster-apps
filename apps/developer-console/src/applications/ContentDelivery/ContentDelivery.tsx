import { useCallback, useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { AnalyticsId } from '@cluster-apps/analytics';
import {
  Paper,
  Docs,
  DocsGroup,
  DocsSection,
  Stack,
  Typography,
  BucketAccess,
  BucketAccessProps,
  LoadingButton,
  useMessages,
  Button,
  GithubLogoIcon,
} from '@cluster-apps/ui';
import { MenuItem, TextField } from '@mui/material';

import { CdnDocsIcon } from './icons';
import { DDC_CLUSTER_NAME } from '~/constants';
import {
  UploadWithCliDoc,
  StreamDoc,
  SuccessDoc,
  GITHUB_GUIDE_LINK,
  GITHUB_TOKEN_BASED_CONTROL_GUIDE_LINK,
} from './docs';

import { useAccount } from '~/hooks';

const ContentDelivery = () => {
  const account = useAccount();
  const { showMessage } = useMessages();
  const [isSaving, setSaving] = useState(false);
  const [bucketName, setBucketName] = useState<string>('');
  const [access, setAccess] = useState<BucketAccessProps['value']>();

  const options = account.buckets ?? [];
  const currentBucket = options.find((b) => b.name === bucketName);
  const currentBucketAccess = access ?? (currentBucket?.isPublic ? 'public' : 'private');

  // When the selected bucket changes, reflect its tracked access.
  useEffect(() => {
    setAccess(undefined);
  }, [bucketName]);

  const handleSaveAccess = useCallback(async () => {
    if (!currentBucket) return;
    setSaving(true);
    try {
      await account.saveBucket(currentBucket.name, { isPublic: currentBucketAccess === 'public' });
      showMessage({ message: 'Bucket access has been saved', appearance: 'success' });
    } catch (e) {
      showMessage({ message: 'Could not save bucket access. Please try again.', appearance: 'error' });
      throw e;
    } finally {
      setSaving(false);
    }
  }, [account, currentBucket, currentBucketAccess, showMessage]);

  return (
    <Stack spacing={2}>
      <Typography variant="h4">Content Delivery</Typography>

      <Paper component={Stack} direction="row" alignItems="center" justifyContent="space-between" padding={2}>
        <Typography variant="h4">Please select one of your buckets</Typography>
        <TextField
          select
          label="Select Your Bucket"
          value={bucketName}
          onChange={(e) => setBucketName(e.target.value)}
          sx={{ minWidth: 300 }}
          InputLabelProps={{ shrink: true }}
          SelectProps={{ displayEmpty: true }}
        >
          <MenuItem value="" disabled>
            Select Your Bucket
          </MenuItem>
          {options.length === 0 && (
            <MenuItem value="-" disabled>
              No buckets
            </MenuItem>
          )}
          {options.map((bucket) => (
            <MenuItem key={bucket.name} value={bucket.name}>
              {bucket.name} · {bucket.isPublic ? 'Public' : 'Private'}
            </MenuItem>
          ))}
        </TextField>
      </Paper>

      {!!bucketName && (
        <>
          <Typography variant="h4">Bucket {bucketName} CDN Options</Typography>

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
        </>
      )}
      <Docs
        icon={<CdnDocsIcon />}
        title="Start streaming now with Cere!"
        description="Enjoy unparalleled speed, reliability and censorship-resistant content streaming"
      >
        <DocsGroup title="Upload your content using DDC SDK">
          <DocsSection analyticId={AnalyticsId.starterGuideStreaming} title="Upload your file step-by-step guide">
            <UploadWithCliDoc />
          </DocsSection>

          <DocsSection
            title="Quick start guide in Github"
            rightSection={
              <Button
                variant="contained"
                color="secondary"
                className={AnalyticsId.repoCereDdcSdkJsBtn}
                href={GITHUB_GUIDE_LINK}
                startIcon={<GithubLogoIcon />}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open in Github
              </Button>
            }
          />
        </DocsGroup>

        <DocsGroup title={`Stream from ${DDC_CLUSTER_NAME}`}>
          <DocsSection analyticId={AnalyticsId.starterDragonOne} title="Step-by-step guide">
            <StreamDoc />
          </DocsSection>

          <DocsSection analyticId={AnalyticsId.successUserStories} title="Success user stories">
            <SuccessDoc />
          </DocsSection>
        </DocsGroup>
      </Docs>
    </Stack>
  );
};

export default observer(ContentDelivery);
