import { useEffect } from 'react';
import { AddCircleOutlinedIcon, Box, Button, LoadingAnimation, styled, Typography, BoxProps } from '@cluster-apps/ui';
import { AnalyticsId } from '@cluster-apps/analytics';

import { Row } from './Row.tsx';
import { RealData } from './types.ts';
import { transformData } from './helpers.ts';
import { useApplicationTour, elementsRendered } from '~/components/ApplicationTour';

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
  data,
  userHasBuckets,
  isLoading,
  onCreateBucket,
  onUpload,
  uploadType,
  uploadStatus,
  setUploadStatus,
  isBucketCreating,
  firstBucketLocked,
  lockUi,
  onUnlockFirstBucket,
  onRowClick,
  selectedBucket,
  onFolderCreate,
  isAccountReady,
  bucketInProgress,
}: {
  data: RealData[];
  onCreateBucket: () => void;
  onUpload: (values: {
    acceptedFiles: File[];
    bucketId: string;
    cnsName: string;
    isFolder: boolean;
    filePath?: string;
  }) => void;
  isLoading: boolean;
  uploadStatus: 'idle' | 'uploading' | 'success' | 'error';
  uploadType: 'file' | 'folder' | 'emptyFolder';
  setUploadStatus: (status: 'idle' | 'uploading' | 'success' | 'error') => void;
  userHasBuckets: boolean;
  isBucketCreating: boolean;
  firstBucketLocked: boolean;
  lockUi: boolean;
  onUnlockFirstBucket: () => void;
  onRowClick: (bucketId: string) => void;
  selectedBucket: string | null;
  onFolderCreate: (bucketId: string, name?: string) => Promise<void>;
  isAccountReady: boolean;
  bucketInProgress?: string;
}) => {
  const rows = transformData(data);

  const handleCloseStatus = () => {
    setUploadStatus('idle');
  };

  useEffect(() => {
    elementsRendered.createBucketScreen = true;

    return () => {
      elementsRendered.createBucketScreen = false;
    };
  }, []);

  const { hideTour } = useApplicationTour();

  const onFirstBucketClick = () => {
    const callback = !userHasBuckets ? onCreateBucket : onUnlockFirstBucket;

    hideTour();
    callback();
  };

  const onCreateNextBucket = () => {
    hideTour();
    onCreateBucket();
  };

  return (
    <CssReset>
      <StyledBox
        locked={lockUi && userHasBuckets}
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
        {isLoading ? (
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
              onRowClick={() => onRowClick(row.bucketId)}
              onCloseUpload={handleCloseStatus}
              onFolderCreate={onFolderCreate}
              lockUi={lockUi}
              bucketInProgress={bucketInProgress}
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
          {userHasBuckets && !firstBucketLocked ? (
            <Button
              startIcon={<AddCircleOutlinedIcon />}
              className={AnalyticsId.createBucketBtn}
              onClick={onCreateNextBucket}
              disabled={isLoading}
              data-tour="bucket"
            >
              {isBucketCreating ? 'Creating Bucket' : 'Create New Bucket'}
            </Button>
          ) : (
            <Button
              onClick={onFirstBucketClick}
              disabled={isLoading || isBucketCreating || !isAccountReady}
              className={AnalyticsId.createFirstBucketBtn}
              data-tour="bucket"
            >
              {isBucketCreating ? 'Creating Your First Bucket...' : 'Create Your First Bucket'}
            </Button>
          )}
          <Typography marginTop={(theme) => theme.spacing(2.5)} variant="caption" fontSize="small">
            Buckets allow you to create discrete and decoupled storage bins for each of your applications
          </Typography>
        </Box>
      </Box>
    </CssReset>
  );
};
