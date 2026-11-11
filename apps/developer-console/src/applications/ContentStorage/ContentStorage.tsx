import { AnalyticsId } from '@cluster-apps/analytics';
import Reporting from '@cluster-apps/reporting';
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
  AddCircleOutlinedIcon,
  useMessages,
} from '@cluster-apps/ui';
import { observer } from 'mobx-react-lite';
import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';

import { useAccount, useFetchDirs } from '~/hooks';
import { DataStorageDocsIcon } from './icons';
import { GITHUB_GUIDE_LINK, StepByStepUploadDoc } from '~/applications/ContentStorage/docs';
import { FileManager } from './FileManager/FileManager';
import { Bucket } from '~/stores';
import { EMPTY_FILE_NAME, DEFAULT_FOLDER_NAME } from '~/constants.ts';
import type { Acl } from '~/storage/ddc/types';

const Container = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.default,
}));

const StyledAlert = styled(Alert)<AlertProps>(() => ({
  display: 'flex',
  alignItems: 'center',
}));

/**
 * Content Storage on the DDC S3 gateway. Buckets are created through the gateway
 * (named, after a one-time Proxy authorization) and tracked client-side; the file
 * manager lists/uploads/downloads objects by bucket name. The old UI is unchanged.
 */
const ContentStorage = () => {
  const account = useAccount();
  const { showMessage } = useMessages();

  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadType, setUploadType] = useState<'file' | 'folder' | 'emptyFolder'>('file');
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [bucketInProgress, setBucketInProgress] = useState<string>();
  const [isBucketCreating, setIsBucketCreating] = useState(false);

  const [buckets, setBuckets] = useState<Bucket[]>(account.buckets ?? []);
  useEffect(() => {
    if (account.buckets !== undefined) {
      setBuckets(account.buckets);
    }
  }, [account.buckets]);

  const { dirs, loading, defaultDirIndices, setDefaultFolderIndex, refetchBucket } = useFetchDirs(
    buckets,
    account.storage,
  );

  // Storage is paid from the DDC deposit; keep the "top up first" gate.
  const isAccountReady = (account.deposit ?? 0) > 0;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (uploadStatus === 'success' || uploadStatus === 'error') {
      timer = setTimeout(() => {
        setUploadStatus('idle');
        setBucketInProgress(undefined);
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [uploadStatus]);

  const aclForBucket = useCallback(
    (bucketName: string): Acl =>
      account.buckets?.find((b) => b.name === bucketName)?.isPublic ? 'public-read' : 'private',
    [account.buckets],
  );

  const onBucketCreation = useCallback(async () => {
    setIsBucketCreating(true);
    try {
      // First create authorizes the gateway (one wallet consent), then mints the bucket.
      const name = await account.createBucket();
      await refetchBucket(name);
      setSelectedBucket(name);
      showMessage({ appearance: 'success', message: 'Bucket created.' });
    } catch (e) {
      Reporting.error(e);
      showMessage({
        appearance: 'error',
        message: 'Could not create the bucket. Please try again.',
        placement: { vertical: 'top', horizontal: 'right' },
      });
    }
    setIsBucketCreating(false);
  }, [account, refetchBucket, showMessage]);

  const handleUpload = useCallback(
    async ({
      acceptedFiles,
      bucketId,
      isFolder,
      filePath,
      emptyFolder = false,
    }: {
      acceptedFiles: File[];
      bucketId: string;
      cnsName: string;
      isFolder: boolean;
      filePath?: string;
      skipQuests?: boolean;
      emptyFolder?: boolean;
    }) => {
      setUploadType(isFolder ? (emptyFolder ? 'emptyFolder' : 'folder') : 'file');
      setBucketInProgress(bucketId);
      setUploadStatus('uploading');
      try {
        const acl = aclForBucket(bucketId);
        await Promise.all(
          acceptedFiles.map((file) => {
            const rel =
              file.webkitRelativePath && file.webkitRelativePath !== '' ? file.webkitRelativePath : file.name;
            const key = `${filePath ?? ''}${isFolder ? rel : file.name}`;
            return account.storage.uploadObject({ bucketName: bucketId, key, body: file, contentType: file.type, acl });
          }),
        );
        await refetchBucket(bucketId);
        setUploadStatus('success');
      } catch (error) {
        Reporting.error(error);
        setUploadStatus('error');
        return null;
      }
    },
    [account.storage, aclForBucket, refetchBucket],
  );

  const handleCloseStatus = () => setUploadStatus('idle');

  const handleRowClick = useCallback(
    (bucketId: string) => {
      if (buckets.length === 0) return;
      setSelectedBucket((prev) => (prev === bucketId ? null : bucketId));
    },
    [buckets.length],
  );

  const handleCreateEmptyFolder = useCallback(
    async (bucketId: string, name: string = '') => {
      const currentDefaultFolderIdx = defaultDirIndices[bucketId] || 0;
      const folderName = name !== '' ? name : `${DEFAULT_FOLDER_NAME}${currentDefaultFolderIdx + 1}`;
      const blob = new Blob([' '], { type: 'text/plain' });
      const file = new File([blob], EMPTY_FILE_NAME, { type: 'text/plain' });
      Object.defineProperty(file, 'webkitRelativePath', {
        value: `${folderName}/${EMPTY_FILE_NAME}`,
        writable: false,
      });
      await handleUpload({ acceptedFiles: [file], bucketId, cnsName: 'fs', isFolder: true, emptyFolder: true });
      setDefaultFolderIndex(bucketId, currentDefaultFolderIdx + 1);
    },
    [defaultDirIndices, handleUpload, setDefaultFolderIndex],
  );

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
          {!isAccountReady && (
            <StyledAlert
              severity="info"
              action={
                <Button component={NavLink} endIcon={<AddCircleOutlinedIcon />} to="/top-up">
                  Top Up
                </Button>
              }
            >
              Your DDC Wallet balance is 0. Please top it up before creating a bucket.
            </StyledAlert>
          )}
          <FileManager
            data={dirs || []}
            userHasBuckets={buckets.length > 0 || false}
            isLoading={loading}
            isBucketsLoading={false}
            onCreateBucket={onBucketCreation}
            onUpload={handleUpload}
            uploadType={uploadType}
            uploadStatus={uploadStatus}
            setUploadStatus={handleCloseStatus}
            isBucketCreating={isBucketCreating}
            firstBucketLocked={buckets.length === 0}
            lockUi={false}
            onUnlockFirstBucket={onBucketCreation}
            onRowClick={handleRowClick}
            selectedBucket={selectedBucket}
            onFolderCreate={handleCreateEmptyFolder}
            isAccountReady={isAccountReady}
            bucketInProgress={bucketInProgress}
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
