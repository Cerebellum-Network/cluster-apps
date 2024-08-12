import { Box, Button, Typography, styled, BoxProps } from '@mui/material';
import { AddCircleOutlinedIcon, LoadingAnimation } from '@developer-console/ui';
import { AnalyticsId } from '@developer-console/analytics';

import { Row } from './Row.tsx';
import { transformData } from './helpers.ts';
import { QuestHint } from '~/components';
import { useContentStorageStore } from '~/hooks/useContentStorageStore.ts';
import { useCallback } from 'react';

/**
 * This component resets default CSS styles.
 */
const CssReset = styled(Box)({
  '& li, ul': {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
});

interface StyledBoxProps extends BoxProps {
  locked?: boolean;
}

const StyledBox = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'locked',
})<StyledBoxProps>(({ locked }) => ({
  opacity: !locked ? '100%' : '30%',
  cursor: !locked ? 'pointer' : 'not-allowed',
}));

export const FileManager = ({
  onUpload,
  uploadType,
  uploadStatus,
  setUploadStatus,
  onFolderCreate,
}: {
  onUpload: (values: {
    acceptedFiles: File[];
    bucketId: string;
    cnsName: string;
    isFolder: boolean;
    filePath?: string;
  }) => void;
  uploadStatus: 'idle' | 'uploading' | 'success' | 'error';
  uploadType: 'file' | 'folder';
  setUploadStatus: (status: 'idle' | 'uploading' | 'success' | 'error') => void;
  isBucketCreating: boolean;
  onFolderCreate: (bucketId: string) => void;
}) => {
  // const [firstBucketLocked, setFirstBucketLocked] = useState(true);
  const {
    dirs,
    buckets,
    setSelectedBucket,
    loading,
    selectedBucket,
    isBucketCreating,
    firstBucketLocked,
    createBucket,
    handleFirstBucketUnlock,
  } = useContentStorageStore();
  const rows = transformData(dirs);

  // useEffect(() => {
  //   const firstBucketLocked = !(buckets.length >= 1 && dirs.filter((s) => !!s.cid).length > 0);
  //   setFirstBucketLocked(firstBucketLocked);
  // }, [buckets.length, dirs]);

  const handleCloseStatus = () => {
    setUploadStatus('idle');
  };

  const handleRowClick = useCallback(
    (bucketId: string) => {
      if (!(firstBucketLocked && buckets.length > 0)) {
        setSelectedBucket(bucketId);
      }
    },
    [buckets.length, firstBucketLocked, setSelectedBucket],
  );

  console.log('firstBucketLocked', firstBucketLocked);

  return (
    <CssReset>
      <StyledBox
        locked={firstBucketLocked && (buckets.length > 0 || false)}
        display="flex"
        alignItems="center"
        padding={(theme) => theme.spacing(1, 1.5)}
      >
        <Typography variant="body1" color="secondary" flex={1}>
          Bucket ID
        </Typography>
        <Typography variant="body1" color="secondary" flex={1.5} textAlign="right">
          Used Storage
        </Typography>
        <Typography variant="body1" color="secondary" flex={1} textAlign="center">
          ACL
        </Typography>
        <Box flex={1}></Box>
      </StyledBox>
      <Box>
        {loading ? (
          <Box display="flex" alignItems="center" justifyContent="center">
            <Box width="96px" height="55px">
              <LoadingAnimation />
            </Box>
          </Box>
        ) : (
          rows.map((row) => (
            <Row
              firstBucketLocked={firstBucketLocked}
              uploadStatus={uploadStatus}
              uploadType={uploadType}
              key={row.bucketId}
              row={row}
              onUpload={onUpload}
              isOpen={selectedBucket === row.bucketId}
              onRowClick={() => handleRowClick(row.bucketId)}
              onCloseUpload={handleCloseStatus}
              onFolderCreate={onFolderCreate}
            />
          ))
        )}
        <Box marginTop="20px" display="flex" alignItems="center" justifyContent="center" flexDirection="column">
          {isBucketCreating && (
            <Box
              display="flex"
              alignItems="center"
              justifyContent="center"
              paddingBottom={(theme) => theme.spacing(2.5)}
            >
              <Box width="96px" height="55px">
                <LoadingAnimation />
              </Box>
            </Box>
          )}
          {buckets.length > 0 && !firstBucketLocked ? (
            <Button
              startIcon={<AddCircleOutlinedIcon />}
              className={AnalyticsId.createBucketBtn}
              onClick={() => createBucket()}
              disabled={loading}
            >
              {isBucketCreating ? 'Creating Bucket' : 'Create New Bucket'}
            </Button>
          ) : (
            <QuestHint
              quest="uploadFile"
              step="createBucket"
              title="Let’s get started!"
              content="Create your first bucket to store your data"
              skip={loading || !firstBucketLocked}
            >
              <Button
                onClick={() => handleFirstBucketUnlock()}
                disabled={loading || isBucketCreating}
                className={AnalyticsId.createFirstBucketBtn}
              >
                {isBucketCreating ? 'Creating Your First Bucket...' : 'Create Your First Bucket'}
              </Button>
            </QuestHint>
          )}
          <Typography marginTop={(theme) => theme.spacing(2.5)} variant="caption" fontSize="small">
            Buckets allow you to create discrete and decoupled storage bins for each of your applications
          </Typography>
        </Box>
      </Box>
    </CssReset>
  );
};
