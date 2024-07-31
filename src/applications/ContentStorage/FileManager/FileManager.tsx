import { Box, Button, Typography, styled, BoxProps } from '@mui/material';
import { AddCircleOutlinedIcon, LoadingAnimation } from '@developer-console/ui';
import { AnalyticsId } from '@developer-console/analytics';

import { Row } from './Row.tsx';
import { RealData } from './types.ts';
import { transformData } from './helpers.ts';
import { QuestHint } from '~/components';

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
  onFileDownload,
  isBucketCreating,
  firstBucketLocked,
  onUnlockFirstBucket,
  onRowClick,
  selectedBucket,
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
  uploadType: 'file' | 'folder';
  setUploadStatus: (status: 'idle' | 'uploading' | 'success' | 'error') => void;
  onFileDownload: (bucketId: string, source: string, name: string) => void;
  userHasBuckets: boolean;
  isBucketCreating: boolean;
  firstBucketLocked: boolean;
  onUnlockFirstBucket: () => void;
  onRowClick: (bucketId: string) => void;
  selectedBucket: string | null;
}) => {
  const rows = transformData(data);

  const handleCloseStatus = () => {
    setUploadStatus('idle');
  };

  return (
    <CssReset>
      <StyledBox
        locked={firstBucketLocked && userHasBuckets}
        display="flex"
        alignItems="center"
        padding={(theme) => theme.spacing(1, 1.5)}
      >
        <Typography variant="body1" flex={1}>
          Bucket ID
        </Typography>
        <Typography variant="body1" flex={1} textAlign="right">
          Used Storage
        </Typography>
        <Typography variant="body1" flex={1} textAlign="center">
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
              onFileDownload={onFileDownload}
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
              onClick={onCreateBucket}
              disabled={isLoading}
            >
              {isBucketCreating ? 'Creating Bucket' : 'Create New Bucket'}
            </Button>
          ) : (
            <QuestHint
              skip={isLoading}
              quest="uploadFile"
              step="createBucket"
              title="Let’s get started!"
              content="Create your first bucket to store your data"
            >
              <Button
                onClick={onUnlockFirstBucket}
                disabled={isBucketCreating}
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
