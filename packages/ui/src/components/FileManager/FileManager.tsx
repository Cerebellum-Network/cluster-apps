import { Box, Button, Typography, styled, CircularProgress } from '@mui/material';
import { Row } from './Row.tsx';

import { AddCircleOutlinedIcon } from '@developer-console/ui';
import { RealData } from './types.ts';
import { transformData } from './helpers.ts';
import { useState } from 'react';

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
  isLoading,
  onCreateBucket,
  onUpload,
  uploadType,
  uploadStatus,
  setUploadStatus,
  onFileDownload,
}: {
  data: RealData[];
  onCreateBucket: () => void;
  onUpload: (values: { acceptedFiles: File[]; bucketId: string; cnsName: string; isFolder: boolean }) => void;
  isLoading: boolean;
  uploadStatus: 'idle' | 'uploading' | 'success' | 'error';
  uploadType: 'file' | 'folder';
  setUploadStatus: (status: 'idle' | 'uploading' | 'success' | 'error') => void;
  onFileDownload: (bucketId: string, source: string, name: string) => void;
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
          <Box display="flex" justifyContent="center" alignItems="center">
            Loading your buckets ...
            <CircularProgress sx={{ marginLeft: '8px', fontSize: '10px' }} />
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
        <Box marginTop="20px" display="flex" alignItems="center" justifyContent="center">
          <Button onClick={onCreateBucket} disabled={isLoading}>
            <AddCircleOutlinedIcon sx={{ marginRight: '8px' }} />
            Create New Bucket
          </Button>
        </Box>
      </Box>
    </CssReset>
  );
};
