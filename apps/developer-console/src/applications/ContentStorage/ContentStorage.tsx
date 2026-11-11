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
} from '@cluster-apps/ui';
import { observer } from 'mobx-react-lite';
import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';

import { useAccount, useFetchDirs } from '~/hooks';
import { DataStorageDocsIcon } from './icons';
import { GITHUB_GUIDE_LINK, StepByStepUploadDoc } from '~/applications/ContentStorage/docs';
import { FileManager } from './FileManager/FileManager';
import { Bucket } from '~/stores';
import { DEFAULT_FOLDER_NAME, EMPTY_FILE_NAME } from '~/constants.ts';
import type { Acl } from '~/storage/ddc/types';

const Container = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.default,
}));

const StyledAlert = styled(Alert)<AlertProps>(() => ({
  display: 'flex',
  alignItems: 'center',
}));

/**
 * Content Storage, revived on the DDC S3 gateway. Objects are stored by key
 * (folder prefixes are just `/`-separated keys), replacing the old `fs` DAG-node
 * layout. The file-manager UI and its tree are unchanged; only the data layer
 * (list/upload/download/share) moved to the gateway.
 */
const ContentStorage = () => {
  const account = useAccount();

  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [uploadType, setUploadType] = useState<'file' | 'folder' | 'emptyFolder'>('file');
  const [bucketInProgress, setBucketInProgress] = useState<string>();
  const [isBucketCreating, setIsBucketCreating] = useState(false);

  const isBucketsLoading = account.bucketsLoading ?? false;
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

  const firstBucketLocked = buckets.length === 0;
  // A deposit is required before a bucket can be created (storage is paid for from
  // the DDC deposit). Keep the old "top up first" gate.
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
    async (bucketId: string): Promise<Acl> => {
      const known = account.buckets?.find((b) => b.id.toString() === bucketId);
      if (known?.isPublic) return 'public-read';
      const info = await account.getBucketInfo(BigInt(bucketId)).catch(() => undefined);
      return info?.isPublic ? 'public-read' : 'private';
    },
    [account],
  );

  const onBucketCreation = useCallback(async () => {
    setIsBucketCreating(true);
    try {
      const createdBucketId = await account.createBucket({ isPublic: true });
      await refetchBucket(createdBucketId, true);
      setSelectedBucket(createdBucketId.toString());
    } catch (e) {
      Reporting.error(e);
    }
    setIsBucketCreating(false);
  }, [account, refetchBucket]);

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
        const acl = await aclForBucket(bucketId);
        await Promise.all(
          acceptedFiles.map((file) => {
            const rel =
              file.webkitRelativePath && file.webkitRelativePath !== '' ? file.webkitRelativePath : file.name;
            const key = `${filePath ?? ''}${isFolder ? rel : file.name}`;
            return account.storage.uploadObject({ bucketName: bucketId, key, body: file, contentType: file.type, acl });
          }),
        );
        await refetchBucket(BigInt(bucketId), acl === 'public-read');
        setUploadStatus('success');
      } catch (error) {
        Reporting.error(error);
        setUploadStatus('error');
        return null;
      }
    },
    [account.storage, aclForBucket, refetchBucket],
  );

  const handleCloseStatus = () => {
    setUploadStatus('idle');
  };

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

      await handleUpload({
        acceptedFiles: [file],
        bucketId,
        cnsName: 'fs',
        isFolder: true,
        emptyFolder: true,
      });

      setDefaultFolderIndex(bucketId.toString(), currentDefaultFolderIdx + 1);
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
              Your DDC Wallet balance is 0. Please top it up.
            </StyledAlert>
          )}
          <FileManager
            data={dirs || []}
            userHasBuckets={buckets.length > 0 || false}
            isLoading={loading}
            isBucketsLoading={isBucketsLoading}
            onCreateBucket={onBucketCreation}
            onUpload={handleUpload}
            uploadType={uploadType}
            uploadStatus={uploadStatus}
            setUploadStatus={handleCloseStatus}
            isBucketCreating={isBucketCreating}
            firstBucketLocked={firstBucketLocked}
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
