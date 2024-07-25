import { Box, Button, Typography, styled } from '@mui/material';
import { Row } from './Row.tsx';

import { AddCircleOutlinedIcon, LoadingAnimation } from '@developer-console/ui';
import { RealData } from './types.ts';
import { transformData } from './helpers.ts';
import { useState } from 'react';
import { GoogleAnalyticsId } from '~/gtm.ts';

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
}: {
  data: RealData[];
  onCreateBucket: () => void;
  onUpload: (values: { acceptedFiles: File[]; bucketId: string; cnsName: string; isFolder: boolean }) => void;
  isLoading: boolean;
  uploadStatus: 'idle' | 'uploading' | 'success' | 'error';
  uploadType: 'file' | 'folder';
  setUploadStatus: (status: 'idle' | 'uploading' | 'success' | 'error') => void;
  onFileDownload: (bucketId: string, source: string, name: string) => void;
  userHasBuckets: boolean;
  isBucketCreating: boolean;
}) => {
  const [openRow, setOpenRow] = useState<string | null>(null);

  const handleRowClick = (bucketId: string) => {
    setOpenRow((prev) => (prev === bucketId ? null : bucketId));
  };

  const rows = transformData(data);

  const handleCloseStatus = () => {
    setUploadStatus('idle');
  };

  return (
    <CssReset>
      <Box display="flex" alignItems="center" padding={(theme) => theme.spacing(1, 1.5)}>
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
      </Box>
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
              uploadStatus={uploadStatus}
              uploadType={uploadType}
              key={row.bucketId}
              row={row}
              onUpload={onUpload}
              isOpen={openRow === row.bucketId}
              onRowClick={() => handleRowClick(row.bucketId)}
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
          {userHasBuckets ? (
            <Button
              startIcon={<AddCircleOutlinedIcon />}
              className={GoogleAnalyticsId.createBucketBtn}
              onClick={onCreateBucket}
              disabled={isLoading}
            >
              {isBucketCreating ? 'Creating Bucket' : 'Create New Bucket'}
            </Button>
          ) : (
            <Button disabled={isBucketCreating} className={GoogleAnalyticsId.createFirstBucketBtn}>
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
