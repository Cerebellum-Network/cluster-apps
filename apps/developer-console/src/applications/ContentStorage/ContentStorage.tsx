import Reporting from '@cluster-apps/reporting';
import {
  Box,
  Stack,
  Button,
  styled,
  Typography,
  Alert,
  AlertProps,
  AddCircleOutlinedIcon,
  IconButton,
  LoadingButton,
  useMessages,
} from '@cluster-apps/ui';
import { observer } from 'mobx-react-lite';
import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';

import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { ContentCopy } from '@mui/icons-material';

import { useAccount, useFetchDirs } from '~/hooks';
import { FileManager } from './FileManager/FileManager';
import { Bucket } from '~/stores';
import { PageHeader, Section, ComingSoon } from '~/components';
import { storageConfig } from '~/storage/storageConfig';
import { EMPTY_FILE_NAME, DEFAULT_FOLDER_NAME } from '~/constants.ts';
import type { Acl } from '~/storage/ddc/types';

/** Folder-upload tuning: a bounded worker pool, with a couple of retries per file. */
const UPLOAD_CONCURRENCY = 4;
const UPLOAD_MAX_RETRIES = 2;

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
  const [isRevoking, setIsRevoking] = useState(false);
  const [s3Open, setS3Open] = useState(false);
  const [disconnectConfirm, setDisconnectConfirm] = useState(false);

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

      const acl = aclForBucket(bucketId);
      const keyFor = (file: File) => {
        const rel = file.webkitRelativePath && file.webkitRelativePath !== '' ? file.webkitRelativePath : file.name;
        return `${filePath ?? ''}${isFolder ? rel : file.name}`;
      };
      // Upload one file, retrying transient failures a couple of times. The gateway
      // client uses multipart for large bodies (see gatewayClient.putObject).
      const uploadOne = async (file: File) => {
        let lastErr: unknown;
        for (let attempt = 0; attempt <= UPLOAD_MAX_RETRIES; attempt++) {
          try {
            await account.storage.uploadObject({
              bucketName: bucketId,
              key: keyFor(file),
              body: file,
              contentType: file.type,
              acl,
            });
            return;
          } catch (e) {
            lastErr = e;
          }
        }
        throw lastErr;
      };

      // Bounded concurrency: a fixed pool of workers drains the file queue, so a
      // large folder does not open hundreds of parallel requests. Failures are
      // collected, not fatal, so a partial upload is reported rather than lost.
      const failures: string[] = [];
      let next = 0;
      const worker = async () => {
        while (next < acceptedFiles.length) {
          const file = acceptedFiles[next++];
          try {
            await uploadOne(file);
          } catch (e) {
            Reporting.error(e);
            failures.push(file.name);
          }
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(UPLOAD_CONCURRENCY, acceptedFiles.length) }, worker),
      );

      await refetchBucket(bucketId);

      if (failures.length === 0) {
        setUploadStatus('success');
      } else {
        setUploadStatus('error');
        const ok = acceptedFiles.length - failures.length;
        showMessage({
          appearance: 'error',
          message:
            ok > 0
              ? `Uploaded ${ok} of ${acceptedFiles.length}. Failed: ${failures.slice(0, 3).join(', ')}${failures.length > 3 ? '…' : ''}`
              : 'Upload failed. Please try again.',
          placement: { vertical: 'top', horizontal: 'right' },
        });
      }
    },
    [account.storage, aclForBucket, refetchBucket, showMessage],
  );

  // Confirmation is handled in-app inside the S3 dialog (no window.confirm).
  const handleRevokeGateway = useCallback(async () => {
    setIsRevoking(true);
    try {
      await account.revokeGateway();
      setS3Open(false);
      setDisconnectConfirm(false);
      showMessage({ appearance: 'success', message: 'Cere no longer manages your storage.' });
    } catch (e) {
      Reporting.error(e);
      showMessage({ appearance: 'error', message: 'Could not update storage management. Please try again.' });
    }
    setIsRevoking(false);
  }, [account, showMessage]);

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

  const s3Endpoint = storageConfig.ddcS3GatewayUrl ?? '';

  return (
    <Stack spacing="20px">
      <PageHeader
        title="Storage"
        actions={
          account.gatewayAuthorized && (
            <Button variant="outlined" color="secondary" onClick={() => setS3Open(true)}>
              S3 access
            </Button>
          )
        }
      />

      {!isAccountReady && (
        <StyledAlert
          severity="info"
          action={
            <Button component={NavLink} endIcon={<AddCircleOutlinedIcon />} to="/billing">
              Add funds
            </Button>
          }
        >
          Your deposit is empty. Add funds in Billing before creating a bucket.
        </StyledAlert>
      )}

      {/* Buckets — from the S3 gateway. The plan quota belongs here (mockup) but
          needs the plan/limits backend, so the slot shows "Coming soon". */}
      <Section
        title="Buckets"
        actions={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography sx={{ fontSize: 13, color: '#5E5C6B' }}>Plan quota</Typography>
            <ComingSoon />
            {buckets.length > 0 && (
              <LoadingButton
                startIcon={<AddCircleOutlinedIcon />}
                loading={isBucketCreating}
                disabled={!isAccountReady}
                onClick={onBucketCreation}
              >
                New bucket
              </LoadingButton>
            )}
          </Stack>
        }
        flush
      >
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
      </Section>

      {/* GET / PUT requests — needs the bills feed, so the section holds its place
          with a Coming soon badge rather than a developer note. */}
      <Section title="GET / PUT requests" actions={<ComingSoon />}>
        <Typography variant="body2" sx={{ color: '#5E5C6B' }}>
          Request counts and data served will show here once your plan is active.
        </Typography>
      </Section>

      {/* S3 access: the endpoint to point an S3 client at. Access keys are not
          issued yet, so they read "Coming soon". */}
      <Dialog
        open={s3Open}
        onClose={() => {
          setS3Open(false);
          setDisconnectConfirm(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>S3 access</DialogTitle>
        <DialogContent>
          <Stack spacing={2} paddingTop={1}>
            <Typography variant="body2" sx={{ color: '#5E5C6B' }}>
              Point any S3-compatible client at this endpoint. Address buckets by the names shown above.
            </Typography>
            <Box>
              <Typography sx={{ fontSize: 12, color: '#818083', marginBottom: 0.5 }}>Endpoint</Typography>
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ border: '1px solid #E3E4EE', borderRadius: '8px', padding: '8px 12px' }}
              >
                <Typography sx={{ fontFamily: 'monospace', fontSize: 13, flex: 1, wordBreak: 'break-all' }}>
                  {s3Endpoint}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => {
                    navigator.clipboard.writeText(s3Endpoint);
                    showMessage({ appearance: 'success', message: 'Endpoint copied.' });
                  }}
                >
                  <ContentCopy sx={{ fontSize: 16 }} />
                </IconButton>
              </Stack>
            </Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography sx={{ fontSize: 13, color: '#5E5C6B' }}>Access key &amp; secret</Typography>
              <ComingSoon />
            </Stack>

            {/* Disconnect S3 lives here, behind an in-app confirm (no window.confirm). */}
            {account.gatewayAuthorized && (
              <Box sx={{ borderTop: '1px solid #E3E4EE', paddingTop: 2 }}>
                {disconnectConfirm ? (
                  <Stack spacing={1}>
                    <Typography variant="body2" sx={{ color: '#5E5C6B' }}>
                      Disconnect Cere from your storage? You can allow it again the next time you create a bucket.
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Button variant="text" color="secondary" disabled={isRevoking} onClick={() => setDisconnectConfirm(false)}>
                        Cancel
                      </Button>
                      <LoadingButton variant="contained" color="error" loading={isRevoking} onClick={handleRevokeGateway}>
                        Disconnect
                      </LoadingButton>
                    </Stack>
                  </Stack>
                ) : (
                  <Button variant="text" color="error" onClick={() => setDisconnectConfirm(true)}>
                    Disconnect S3
                  </Button>
                )}
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="text" color="secondary" onClick={() => setS3Open(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default observer(ContentStorage);
