import { AnalyticsId } from '@cluster-apps/analytics';
import {
  Docs,
  DocsGroup,
  DocsSection,
  GithubLogoIcon,
  Box,
  Button,
  styled,
  Typography,
  Alert,
  AlertProps,
  useMessages,
} from '@cluster-apps/ui';
import { observer } from 'mobx-react-lite';
import { useCallback, useEffect, useState } from 'react';

import { useAccount, useFetchDirs } from '~/hooks';
import { DataStorageDocsIcon } from './icons';
import { GITHUB_GUIDE_LINK, StepByStepUploadDoc } from '~/applications/ContentStorage/docs';
import { FileManager } from './FileManager/FileManager';
import { Bucket } from '~/stores';

const Container = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.default,
}));

const StyledAlert = styled(Alert)<AlertProps>(() => ({
  display: 'flex',
  alignItems: 'center',
}));

/** Shown wherever a storage write is attempted while the write path is deferred. */
const PENDING_MESSAGE =
  'Creating buckets and uploading files is pending the storage-gateway integration — coming in the next phase.';

/**
 * Content Storage — Phase 0 (read-only revival). Sign-in, the on-chain deposit
 * and the account's bucket list are live; creating buckets and uploading files
 * are deferred to the gateway-integration phase (the DDC S3 gateway only serves
 * buckets created through it, which the old per-bucket UI predates). The write
 * controls surface a "coming next" notice instead of acting.
 */
const ContentStorage = () => {
  const account = useAccount();
  const { showMessage } = useMessages();

  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);

  const isBucketsLoading = account.bucketsLoading ?? false;
  const [buckets, setBuckets] = useState<Bucket[]>(account.buckets ?? []);
  useEffect(() => {
    if (account.buckets !== undefined) {
      setBuckets(account.buckets);
    }
  }, [account.buckets]);

  const { dirs, loading } = useFetchDirs(buckets);

  const notifyPending = useCallback(() => {
    showMessage({
      appearance: 'info',
      message: PENDING_MESSAGE,
      placement: { vertical: 'top', horizontal: 'right' },
    });
  }, [showMessage]);

  const handleCloseStatus = () => setUploadStatus('idle');

  const handleRowClick = useCallback(
    (bucketId: string) => {
      if (buckets.length === 0) return;
      setSelectedBucket((prev) => (prev === bucketId ? null : bucketId));
    },
    [buckets.length],
  );

  // Write actions are deferred this phase: surface the notice, do nothing else.
  const onBucketCreation = useCallback(async () => notifyPending(), [notifyPending]);
  const handleUpload = useCallback(async () => {
    notifyPending();
    return null;
  }, [notifyPending]);
  const handleCreateEmptyFolder = useCallback(async () => notifyPending(), [notifyPending]);

  return (
    <>
      <Box
        display="flex"
        flexDirection="column"
        border={(theme) => `1px solid ${theme.palette.divider}`}
        borderRadius="12px"
        marginBottom="20px"
      >
        <Box padding="34px 32px" borderBottom={(theme) => `1px solid ${theme.palette.divider}`}>
          <Typography variant="h3">Content Storage</Typography>
        </Box>
        <Container padding="24px" borderRadius={(theme) => theme.spacing(0, 0, 1.5, 1.5)}>
          <StyledAlert severity="info" sx={{ marginBottom: 2 }}>
            Read-only preview: browsing your buckets is live. Creating buckets and uploading files is pending the
            storage-gateway integration (next phase).
          </StyledAlert>
          <FileManager
            data={dirs || []}
            userHasBuckets={buckets.length > 0 || false}
            isLoading={loading}
            isBucketsLoading={isBucketsLoading}
            onCreateBucket={onBucketCreation}
            onUpload={handleUpload}
            uploadType="file"
            uploadStatus={uploadStatus}
            setUploadStatus={handleCloseStatus}
            isBucketCreating={false}
            firstBucketLocked={buckets.length === 0}
            lockUi={false}
            onUnlockFirstBucket={onBucketCreation}
            onRowClick={handleRowClick}
            selectedBucket={selectedBucket}
            onFolderCreate={handleCreateEmptyFolder}
            isAccountReady
            bucketInProgress={undefined}
          />
        </Container>
      </Box>

      <Docs
        icon={<DataStorageDocsIcon />}
        title="Get started with Decentralised cloud storage "
        description="Store your app's data securely across a decentralized network and maintain complete control over your data sovereignty"
      >
        <DocsGroup title="Upload your content using DDC SDK">
          <DocsSection analyticId={AnalyticsId.starterGuideStorage} title="Upload your file step-by-step guide">
            <StepByStepUploadDoc />
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
      </Docs>
    </>
  );
};

export default observer(ContentStorage);
