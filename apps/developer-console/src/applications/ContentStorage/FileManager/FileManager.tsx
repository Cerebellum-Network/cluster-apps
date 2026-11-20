import { useEffect } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  LoadingAnimation,
  styled,
  Typography,
  BoxProps,
} from '@cluster-apps/ui';
import { AnalyticsId } from '@cluster-apps/analytics';

import { Row } from './Row.tsx';
import { RealData } from './types.ts';
import { transformData } from './helpers.ts';
import { useApplicationTour, elementsRendered } from '~/components/ApplicationTour';
import { text } from '~/theme/tokens';

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
  isBucketsLoading,
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
  isBucketsLoading: boolean;
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

  return (
    <CssReset>
      <StyledBox
        locked={lockUi && userHasBuckets}
        display="flex"
        alignItems="center"
        padding="8px 22px"
      >
        <Typography flex={4} sx={text.label}>
          Bucket
        </Typography>
        <Typography flex={1.4} textAlign="right" sx={text.label}>
          Stored
        </Typography>
        <Typography flex={1} textAlign="center" sx={text.label}>
          Access
        </Typography>
        <Box flex={1}></Box>
      </StyledBox>
      <Box>
        {isBucketsLoading ? (
          <Box display="flex" alignItems="center" justifyContent="center" padding={(theme) => theme.spacing(2)}>
            <CircularProgress size={24} />
            <Typography variant="body2" color="text.secondary" marginLeft={(theme) => theme.spacing(1)}>
              Loading buckets...
            </Typography>
          </Box>
        ) : isLoading ? (
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
        <Box marginTop="20px" paddingBottom="24px" display="flex" alignItems="center" justifyContent="center" flexDirection="column">
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
          {/* Adding more buckets is the "New bucket" primary in the card header
              (ContentStorage). Only the first-bucket onboarding CTA stays here. */}
          {(!userHasBuckets || firstBucketLocked) && (
            <Button
              variant="contained"
              onClick={onFirstBucketClick}
              disabled={isBucketCreating || !isAccountReady}
              className={AnalyticsId.createFirstBucketBtn}
              data-tour="bucket"
            >
              {isBucketCreating ? 'Creating your first bucket…' : 'Create your first bucket'}
            </Button>
          )}
          <Typography sx={{ ...text.secondary, marginTop: '12px' }}>
            A bucket keeps one app’s files apart from the rest. Create one per app.
          </Typography>
        </Box>
      </Box>
    </CssReset>
  );
};
