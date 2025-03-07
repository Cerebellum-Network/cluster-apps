import { AnalyticsId } from '@cluster-apps/analytics';
import Reporting from '@cluster-apps/reporting';
import {
  Box,
  Button,
  styled,
  Typography,
  Alert,
  AlertProps,
  AddCircleOutlinedIcon,
  Paper,
  Stack,
  IconButton,
  CloseIcon,
} from '@cluster-apps/ui';
import { observer } from 'mobx-react-lite';
import { useAccount, useQuestsStore, useCachedFetchDirs } from '~/hooks';
import { useCallback, useEffect, useState } from 'react';
import { DagNode, DagNodeUri, Link, File as DdcFile, FileContent } from '@cere-ddc-sdk/ddc-client';
import { FileManager } from './FileManager/FileManager';
import { DEFAULT_FOLDER_NAME, EMPTY_FILE_NAME } from '~/constants.ts';
import { NavLink } from 'react-router-dom';
import { useMessages } from '@cluster-apps/ui';
import { RealData } from './FileManager/types';
import SmartLoadingNotification from '~/components/SmartLoadingNotification/SmartLoadingNotification';

const Container = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.default,
}));

const StyledAlert = styled(Alert)<AlertProps>(() => ({
  display: 'flex',
  alignItems: 'center',
}));

const InfoBar = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(3),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.mode === 'dark' 
    ? 'rgba(122, 159, 255, 0.1)' 
    : 'rgba(122, 159, 255, 0.05)',
  border: `1px solid ${theme.palette.divider}`,
  position: 'relative',
}));

const TitleContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: theme.spacing(3),
}));

const HeaderContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  marginBottom: '16px',
});

const ContentStorage = () => {
  const account = useAccount();
  const questsStore = useQuestsStore();
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [uploadType, setUploadType] = useState<'file' | 'folder' | 'emptyFolder'>('file');
  const [bucketInProgress, setBucketInProgress] = useState<string>();
  const [isBucketCreating, setIsBucketCreating] = useState(false);
  
  const { 
    dirs, 
    loading, 
    refetchBucket,
    isCached,
    lastUpdated,
    forceRefresh
  } = useCachedFetchDirs(
    account.buckets || [], 
    account.ddc,
    `buckets-${account.address || 'default'}`
  );
  
  const { showMessage } = useMessages();
  const [lockUi, setLockUi] = useState(false);
  const [firstBucketLocked, setFirstBucketLocked] = useState(false);
  const [showInfoBar, setShowInfoBar] = useState(() => {
    return localStorage.getItem('hideFileManagerInfoBar') !== 'true';
  });

  const onUnlockFirstBucket = useCallback(() => {
    setFirstBucketLocked(false);
  }, []);

  const onRowClick = useCallback((bucketId: string) => {
    setSelectedBucket(bucketId);
  }, []);

  const onFolderCreate = useCallback(async (bucketId: string, name?: string) => {
    // Implementation for folder creation
  }, []);

  const onAccessChange = useCallback(async (bucketId: string, isPublic: boolean) => {
    // Implementation for access change
  }, []);

  const onBucketCreation = useCallback(async () => {
    if (isBucketCreating) {
      return;
    }

    setIsBucketCreating(true);

    try {
      const bucketId = await account.createBucket({
        isPublic: false,
      });

      await refetchBucket(bucketId);
      showMessage({ message: 'Bucket created successfully', appearance: 'success' });
      questsStore.markStepDone('uploadFile', 'createBucket');
    } catch (error) {
      console.error('Failed to create bucket:', error);
      showMessage({ message: 'Failed to create bucket', appearance: 'error' });
    } finally {
      setIsBucketCreating(false);
    }
  }, [account, isBucketCreating, questsStore, refetchBucket, showMessage]);

  const handleCloseStatus = useCallback(() => {
    setUploadStatus('idle');
    setBucketInProgress(undefined);
  }, []);

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
      const existingDagNode = await account.ddc!
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
        (link: Link) =>
          link.name !== `${DEFAULT_FOLDER_NAME}${defaultDirIndex === 0 ? '' : defaultDirIndex}/${EMPTY_FILE_NAME}`,
      );

      const file = new DdcFile(acceptedFile.stream() as FileContent, { size: acceptedFile.size });
      const uri = await account.ddc!.store(BigInt(bucketId!), file);

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

      await account.ddc!.store(BigInt(bucketId), dagNode, { name: cnsName });

      return {
        cid: uri.cid,
        path: `${filePath || ''}${acceptedFile.webkitRelativePath || acceptedFile.name}`,
        contentType: acceptedFile.type,
        size: acceptedFile.size,
      };
    },
    [account.ddc],
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
      const currentBucket = account.buckets.find((bucket) => bucket.id.toString() === bucketId.toString());
      setUploadType(isFolder ? (emptyFolder ? 'emptyFolder' : 'folder') : 'file');
      questsStore.markStepDone('uploadFile', 'startUploading');
      setBucketInProgress(bucketId);

      if (!isFolder) {
        setUploadStatus('uploading');
        try {
          const acceptedFile = acceptedFiles[0];
          await singleFileUpload({ acceptedFile, bucketId, cnsName, filePath, isFolder: false });
          await new Promise((resolve) => setTimeout(resolve, 5000));
          await refetchBucket(BigInt(bucketId), currentBucket?.isPublic);

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

      setUploadStatus('uploading');
      try {
        const promises = acceptedFiles.map((acceptedFile) =>
          singleFileUpload({ acceptedFile, bucketId, cnsName, filePath, isFolder }),
        );
        await Promise.all(promises);
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await refetchBucket(BigInt(bucketId), currentBucket?.isPublic);

        if (!skipQuests) {
          /**
           * Mark the file upload quest as completed
           */
          questsStore.markCompleted('uploadFile');
          setUploadStatus('success');
        }
      } catch (err) {
        Reporting.error(err);
        setUploadStatus('error');

        return null;
      }
    },
    [account.buckets, account.ddc, questsStore, refetchBucket, singleFileUpload],
  );

  const handleHideInfoBar = (permanent: boolean) => {
    setShowInfoBar(false);
    if (permanent) {
      localStorage.setItem('hideFileManagerInfoBar', 'true');
    }
  };

  const handleRefresh = useCallback(() => {
    forceRefresh();
    showMessage({ 
      message: 'Refreshing bucket data...', 
      appearance: 'info' 
    });
  }, [forceRefresh, showMessage]);

  return (
    <Container>
      <HeaderContainer>
        <Typography variant="h4">File Manager</Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {isCached && (
            <Box 
              component="span" 
              sx={{ 
                display: 'flex',
                alignItems: 'center',
                mr: 2
              }}
            >
              <Box 
                component="span" 
                sx={{ 
                  width: 8, 
                  height: 8, 
                  borderRadius: '50%', 
                  bgcolor: 'success.main', 
                  display: 'inline-block',
                  mr: 0.5
                }} 
              />
              <Typography variant="caption" color="text.secondary">
                Cached
              </Typography>
            </Box>
          )}
          <Button 
            variant="contained"
            size="small" 
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </Box>
      </HeaderContainer>
      
      <Container padding="24px" borderRadius={(theme) => theme.spacing(0, 0, 1.5, 1.5)}>
        {showInfoBar && (
          <InfoBar>
            <Box>
              <Typography variant="subtitle1" fontWeight="bold">
                Welcome to the File Manager
              </Typography>
              <Typography variant="body2">
                Create buckets to store and organize your files on the decentralized network.
              </Typography>
            </Box>
            <IconButton 
              size="small" 
              onClick={() => {
                setShowInfoBar(false);
                localStorage.setItem('hideFileManagerInfoBar', 'true');
              }}
            >
              <CloseIcon />
            </IconButton>
          </InfoBar>
        )}
        
        {loading && !isCached ? (
          <SmartLoadingNotification 
            isLoading={loading} 
            loadingTime={10000} 
            showAfterDelay={1000}
          />
        ) : (
          <FileManager
            data={dirs as RealData[]}
            userHasBuckets={(account.buckets?.length || 0) > 0}
            isLoading={false}
            onCreateBucket={onBucketCreation}
            onUpload={handleUpload}
            uploadType={uploadType}
            uploadStatus={uploadStatus}
            setUploadStatus={handleCloseStatus}
            isBucketCreating={isBucketCreating}
            firstBucketLocked={firstBucketLocked}
            lockUi={lockUi}
            onUnlockFirstBucket={onUnlockFirstBucket}
            onRowClick={onRowClick}
            selectedBucket={selectedBucket}
            onFolderCreate={onFolderCreate}
            isAccountReady={true}
            bucketInProgress={bucketInProgress}
            onAccessChange={onAccessChange}
            showTitle={false}
          />
        )}
      </Container>
    </Container>
  );
};

export default observer(ContentStorage);
