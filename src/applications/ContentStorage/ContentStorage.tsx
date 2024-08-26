import { AnalyticsId } from '@developer-console/analytics';
import Reporting from '@developer-console/reporting';
import {
  Docs,
  DocsGroup,
  DocsSection,
  GithubLogoIcon,
  Box,
  Button,
  styled,
  Typography,
  MetricsChart,
  Alert,
  AlertProps,
  AddCircleOutlinedIcon,
} from '@developer-console/ui';
import { observer } from 'mobx-react-lite';
import { useAccount, useFetchDirs, useQuestsStore } from '~/hooks';
import { useCallback, useEffect, useState } from 'react';
import { DagNode, DagNodeUri, Link, File as DdcFile, Tag, FileContent } from '@cere-ddc-sdk/ddc-client';
import { DataStorageDocsIcon } from './icons';
import { GITHUB_GUIDE_LINK, StepByStepUploadDoc } from '~/applications/ContentStorage/docs';
import { FileManager } from './FileManager/FileManager';
import { Bucket } from '~/stores';
import { DEFAULT_FOLDER_NAME, EMPTY_FILE_NAME } from '~/constants.ts';
import { NavLink } from 'react-router-dom';

const Container = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.default,
}));

const StyledAlert = styled(Alert)<AlertProps>(() => ({
  display: 'flex',
  alignItems: 'center',
}));

const ContentStorage = () => {
  const questsStore = useQuestsStore();
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [uploadType, setUploadType] = useState<'file' | 'folder' | 'emptyFolder'>('file');
  const [isBucketCreating, setIsBucketCreating] = useState(false);
  const [firstBucketLocked, setFirstBucketLocked] = useState(true);
  const [lockUi, setLockUi] = useState<boolean>(true);
  const [isAccountReady, setIsAccountReady] = useState<boolean>(false);

  const account = useAccount();

  const ddcClient = account.ddc;

  const [buckets, setBuckets] = useState<Bucket[]>(account.buckets || []);

  const { dirs, loading, defaultDirIndices, setDefaultFolderIndex, refetchBucket } = useFetchDirs(buckets, ddcClient);

  useEffect(() => {
    if (buckets.length <= 1 && dirs.filter((s) => !!s.cid).length === 0 && account.deposit === 0) {
      setIsAccountReady(false);
    } else {
      setIsAccountReady(true);
    }
  }, [account.deposit, buckets.length, dirs]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (uploadStatus === 'success' || uploadStatus === 'error') {
      timer = setTimeout(() => {
        setUploadStatus('idle');
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [uploadStatus]);

  useEffect(() => {
    const firstBucketLocked = !(buckets.length >= 1 && dirs.filter((s) => !!s.cid).length > 0);
    setFirstBucketLocked(firstBucketLocked);
    setLockUi(firstBucketLocked);
  }, [buckets.length, dirs, dirs.length, questsStore]);

  const handleFirstBucketUnlock = useCallback(async () => {
    questsStore.markStepDone('uploadFile', 'createBucket');

    setIsBucketCreating(true);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    if (buckets.length > 0) {
      setSelectedBucket(buckets[0].id.toString());
    }

    setIsBucketCreating(false);
    setLockUi(false);
  }, [buckets, questsStore]);

  const onBucketCreation = useCallback(async () => {
    if (!ddcClient) return;

    questsStore.markStepDone('uploadFile', 'createBucket');
    setIsBucketCreating(true);
    const createdBucketId = await account.createBucket({ isPublic: true });
    const bucketInfo = await ddcClient.getBucket(createdBucketId);
    if (bucketInfo) {
      setBuckets((prevState) => {
        return [
          ...prevState,
          { id: bucketInfo.bucketId, isPublic: bucketInfo.isPublic, isRemoved: bucketInfo.isRemoved, stats: undefined },
        ];
      });
      await refetchBucket(createdBucketId);
      setSelectedBucket(createdBucketId.toString());
    }
    setIsBucketCreating(false);
    setLockUi(false);
  }, [account, ddcClient, questsStore, refetchBucket]);

  const singleFileUpload = useCallback(
    async ({
      acceptedFile,
      cnsName,
      bucketId,
      isFolder,
      filePath,
    }: {
      acceptedFile: File;
      bucketId: string;
      cnsName: string;
      isFolder: boolean;
      filePath?: string;
    }) => {
      const dagNodeData = JSON.stringify({ createTime: Date.now() });
      const existingDagNode = await ddcClient!
        .read(new DagNodeUri(BigInt(bucketId), cnsName), {
          cacheControl: 'no-cache',
        })
        .catch(() => new DagNode(dagNodeData));

      let defaultDirIndex = 0;
      if (filePath) {
        const match = filePath.match(/default(\d*)/);
        if (match) {
          defaultDirIndex = match[1] ? parseInt(match[1], 10) : 0;
        }
      }

      const existingDagNodeLinks = existingDagNode.links.filter(
        (link) =>
          link.name !== `${DEFAULT_FOLDER_NAME}${defaultDirIndex === 0 ? '' : defaultDirIndex}/${EMPTY_FILE_NAME}`,
      );

      const file = new DdcFile(acceptedFile.stream() as FileContent, { size: acceptedFile.size });
      const uri = await ddcClient!.store(BigInt(bucketId!), file);

      Reporting.fileUploaded({
        bucketId: BigInt(bucketId),
        cid: uri.cid,
        name: acceptedFile.name,
        type: acceptedFile.type,
        size: acceptedFile.size,
      });

      const fileLink = new Link(
        uri.cid,
        acceptedFile.size,
        isFolder
          ? `${filePath || ''}${acceptedFile.webkitRelativePath !== '' ? acceptedFile.webkitRelativePath : acceptedFile.name}`
          : `${filePath ? filePath : ''}${acceptedFile.name}`,
      );

      const dagNode = new DagNode(dagNodeData, [...existingDagNodeLinks, fileLink]);

      await ddcClient!.store(BigInt(bucketId), dagNode, { name: cnsName });

      return {
        cid: uri.cid,
        path: `${filePath || ''}${acceptedFile.webkitRelativePath || acceptedFile.name}`,
        contentType: acceptedFile.type,
        size: acceptedFile.size,
      };
    },
    [ddcClient],
  );

  const handleUpload = useCallback(
    async ({
      acceptedFiles,
      bucketId,
      cnsName,
      isFolder,
      filePath,
      skipQuests = false,
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
      questsStore.markStepDone('uploadFile', 'startUploading');

      if (!isFolder) {
        setUploadStatus('uploading');
        try {
          const acceptedFile = acceptedFiles[0];
          await singleFileUpload({ acceptedFile, bucketId, cnsName, filePath, isFolder: false });
          await new Promise((resolve) => setTimeout(resolve, 5000));
          await refetchBucket(BigInt(bucketId));

          if (!skipQuests) {
            /**
             * Mark the file upload quest as completed
             */
            questsStore.markCompleted('uploadFile');
            setUploadStatus('success');
          }

          return;
        } catch (err) {
          Reporting.error(err);
          setUploadStatus('error');

          return null;
        }
      }
      try {
        setUploadStatus('uploading');

        const dagNodeData = JSON.stringify({ createTime: Date.now() });

        const existingDagNode = await ddcClient!
          .read(new DagNodeUri(BigInt(bucketId), cnsName), {
            cacheControl: 'no-cache',
          })
          .catch(() => new DagNode(dagNodeData));

        const uploadedFiles = await Promise.all(
          acceptedFiles.map(
            async (acceptedFile) =>
              await singleFileUpload({ acceptedFile, cnsName, bucketId, filePath, isFolder: true }),
          ),
        );

        const validUploadedFiles = uploadedFiles.filter(
          (file): file is { path: string; cid: string; size: number; contentType: string } =>
            file !== null && file !== undefined,
        );

        const appDagNode = new DagNode(
          JSON.stringify({ createTime: Date.now() }),
          [...existingDagNode.links, ...validUploadedFiles.map(({ path, cid, size }) => new Link(cid, size, path))],
          validUploadedFiles.map(({ contentType }) => new Tag('content-type', contentType)),
        );

        const appDagNodeUri = await ddcClient.store(BigInt(bucketId), appDagNode, cnsName ? { name: cnsName } : {});

        await new Promise((resolve) => setTimeout(resolve, 5000));

        await refetchBucket(BigInt(bucketId));

        if (!skipQuests) {
          /**
           * Mark the file upload quest as completed
           */
          questsStore.markCompleted('uploadFile');
        }
        setUploadStatus('success');

        return appDagNodeUri.cid;
      } catch (e) {
        setUploadStatus('error');
        console.error(e);
        return null;
      }
    },
    [ddcClient, questsStore, refetchBucket, singleFileUpload],
  );

  const handleCloseStatus = () => {
    setUploadStatus('idle');
  };

  const handleRowClick = useCallback(
    (bucketId: string) => {
      if (!(firstBucketLocked && buckets.length > 0)) {
        setSelectedBucket((prev) => (prev === bucketId ? null : bucketId));
      }
    },
    [buckets.length, firstBucketLocked],
  );

  const handleCreateEmptyFolder = useCallback(
    async (bucketId: string) => {
      const text = ' ';
      const blob = new Blob([text], { type: 'text/plain' });
      const file = new File([blob], EMPTY_FILE_NAME, { type: 'text/plain' });

      const dataTransfer = new DataTransfer();
      const currentDefaultFolderIdx = defaultDirIndices[bucketId];
      const fileWithPath = new File([blob], `${DEFAULT_FOLDER_NAME}${currentDefaultFolderIdx + 1}/${file.name}`, {
        type: 'text/plain',
      });
      Object.defineProperty(fileWithPath, 'webkitRelativePath', {
        value: `${DEFAULT_FOLDER_NAME}${(currentDefaultFolderIdx ? currentDefaultFolderIdx : 0) + 1}/${file.name}`,
        writable: false,
      });

      dataTransfer.items.add(fileWithPath);

      const files = dataTransfer.files;

      await handleUpload({
        acceptedFiles: Array.from(files),
        bucketId,
        cnsName: 'fs',
        isFolder: true,
        skipQuests: true,
        emptyFolder: true,
      });

      setDefaultFolderIndex(bucketId.toString(), (currentDefaultFolderIdx ? currentDefaultFolderIdx : 0) + 1);
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
            onCreateBucket={onBucketCreation}
            onUpload={handleUpload}
            uploadType={uploadType}
            uploadStatus={uploadStatus}
            setUploadStatus={handleCloseStatus}
            isBucketCreating={isBucketCreating}
            firstBucketLocked={firstBucketLocked}
            lockUi={lockUi}
            onUnlockFirstBucket={handleFirstBucketUnlock}
            onRowClick={handleRowClick}
            selectedBucket={selectedBucket}
            onFolderCreate={handleCreateEmptyFolder}
            isAccountReady={isAccountReady}
          />
        </Container>
      </Box>

      <Box marginBottom={2}>
        <MetricsChart history={account.metrics?.history} />
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
