import path from 'path';
import Resizer from 'react-image-file-resizer';
import { useState } from 'react';
import {
  Box,
  BoxProps,
  Button,
  ButtonGroup,
  IconButton,
  styled,
  Typography,
  AddCircleOutlinedIcon,
  ArrowRightIcon,
  Truncate,
  useIsDesktop,
  CircularProgress,
} from '@cluster-apps/ui';
import { DownloadIcon, FilledFolderIcon, FolderIcon, ShareIcon, useMessages } from '@cluster-apps/ui';
import TreeView, { flattenTree, INode } from 'react-accessible-treeview';
import { RowData } from './types.ts';
import { bytesToSize } from './helpers.ts';
import { DDC_STORAGE_NODE_URL, EMPTY_FILE_NAME } from '~/constants.ts';
import { UploadStatus } from './UploadStatus.tsx';
import { UploadButton } from './UploadButton.tsx';
import { useAccount } from '~/hooks';
import { ResizeDialogButton, ResolutionEntry } from './ResizeDialogButton.tsx';

interface StyledRowProps extends BoxProps {
  open: boolean;
  locked?: boolean;
}
const StyledRow = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'open' && prop !== 'locked',
})<StyledRowProps>(({ theme, open, locked }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: '16px 12px',
  '&:hover': {
    cursor: !locked ? 'pointer' : 'not-allowed',
    backgroundColor: '#7A9FFF0A',
  },
  '&:nth-of-type(odd)': {
    backgroundColor: open ? theme.palette.common.white : '#7A9FFF0A',
  },
  backgroundColor: open ? theme.palette.common.white : 'transparent',
  border: open ? `1px solid ${theme.palette.divider}` : 'none',
  borderBottom: open ? `1px solid ${theme.palette.divider}` : 'none',
  borderRadius: open ? theme.spacing(0.5, 0.5, 0, 0) : 'none',
  opacity: !locked ? '100%' : '30%',
  cursor: !locked ? 'pointer' : 'not-allowed',
}));

const ExpandedRow = styled(Box)<StyledRowProps>(({ theme, open }) => ({
  backgroundColor: theme.palette.common.white,
  border: `1px solid ${theme.palette.divider}`,
  borderTop: 'none',
  borderRadius: theme.spacing(0, 0, 0.5, 0.5),
  boxShadow: '0px 8px 12px 0px #1A0A7C1A',
  maxHeight: '352px',
  overflowY: 'auto',
  width: '100%',
  '&:not(:last-child)': {
    marginBottom: open ? theme.spacing(1) : 0,
  },
}));

export const Row = ({
  row,
  onUpload,
  uploadStatus,
  uploadType,
  onRowClick,
  isOpen,
  onCloseUpload,
  firstBucketLocked,
  lockUi,
  onFolderCreate,
  bucketInProgress,
}: {
  row: RowData;
  onUpload: (values: {
    acceptedFiles: File[];
    bucketId: string;
    cnsName: string;
    isFolder: boolean;
    filePath?: string;
  }) => Promise<string | null>;
  uploadStatus: 'idle' | 'uploading' | 'success' | 'error';
  uploadType: 'file' | 'folder' | 'emptyFolder';
  isOpen: boolean;
  onRowClick: () => void;
  onCloseUpload: () => void;
  firstBucketLocked: boolean;
  lockUi: boolean;
  onFolderCreate: (bucketId: string, name?: string) => Promise<void>;
  bucketInProgress?: string;
}) => {
  const account = useAccount();

  const ddcClient = account.ddc;
  const { showMessage } = useMessages();

  const isDesktop = useIsDesktop();

  const treeData = flattenTree(row.files);

  const [downloadingNodeId, setDownloadingNodeId] = useState<INode['id'] | null>(null);

  const performDownload = async ({ bucketId, element }: { bucketId: string; element: INode }): Promise<Response> => {
    const cid = (await resolveCid(bucketId))?.toString();
    const tokenCid = cid; // TODO: use file seed instead when DDC supports it: element.metadata?.cid as string;
    const token = element.metadata?.isPublic ? undefined : await account.createAuthToken(BigInt(bucketId), tokenCid);

    const downloadUrl = getUrl({ bucketId, cid, element, token: token?.toString() });
    return await fetch(downloadUrl);
  };

  const handleDownload = async ({ bucketId, element }: { bucketId: string; element: INode }) => {
    try {
      const response = await performDownload({ bucketId, element });

      if (!response.ok) {
        console.error(`Failed to fetch file: ${response.statusText}`);
      }

      setDownloadingNodeId(element.id);

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = element.name;
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error('Download error:', error);
    } finally {
      setDownloadingNodeId(null);
    }
  };

  const handleCopyLink = async ({ row, element }: { row: RowData; element: INode }) => {
    try {
      const cid = (await resolveCid(row.bucketId))?.toString();
      const tokenCid = cid; // TODO: use file seed instead when DDC supports it: element.metadata?.cid as string;
      const token = element.metadata?.isPublic
        ? undefined
        : await account.createAuthToken(BigInt(row.bucketId), tokenCid);

      await copyToClipboard({
        bucketId: row.bucketId,
        cid,
        element,
        token: token?.toString(),
      });

      showLinkCopiedMessage();
    } catch (error) {
      console.error('Failed to copy link:', error);
      showMessage({
        appearance: 'error',
        message: 'Failed to copy link. Please try again.',
        placement: {
          vertical: 'top',
          horizontal: 'right',
        },
      });
    }
  };

  const onResizeSubmit = async (bucketId: string, element: INode, resolutions: ResolutionEntry[]) => {
    const response = await performDownload({ bucketId, element });
    if (!response.ok) {
      console.error(`Failed to fetch file: ${response.statusText}`);
    }
    const blob = await response.blob(); // Convert to binary Blob

    for (const resolution of resolutions) {
      const finalFullPath = _add_postfix(element?.metadata?.fullPath as string, String(resolution.maxWidth));

      const file = new File([blob], finalFullPath, { type: blob.type });
      const baseName = path.basename(finalFullPath);
      let compressFormat: 'JPEG' | 'PNG' | 'WEBP' = 'JPEG';
      if (baseName.includes('.png')) {
        compressFormat = 'PNG';
      } else if (baseName.includes('.webp')) {
        compressFormat = 'WEBP';
      }
      const resizedFile = await resizeFileWrapped(file, resolution.maxWidth, compressFormat);

      const cid = await onUpload({
        acceptedFiles: [resizedFile],
        bucketId: row.bucketId,
        cnsName: 'fs',
        isFolder: false,
        filePath: '',
      });

      console.log(`Uploaded file ${finalFullPath} with cid: ${cid}`);
    }
  };

  const _add_postfix = (filename: string, postfix: string) => {
    const nameParts = filename.split('.');
    const extension = nameParts.pop(); // Get the file extension
    const baseName = nameParts.join('.'); // Join the rest (handles multiple dots in name)
    return `${baseName}_${postfix}.${extension}`;
  };

  const resizeFileWrapped = (
    file: File,
    minWidth: number,
    compressFormat: 'JPEG' | 'PNG' | 'WEBP' = 'JPEG',
  ): Promise<File> =>
    new Promise((resolve) => {
      Resizer.imageFileResizer(
        file,
        minWidth,
        minWidth,
        compressFormat,
        100,
        0,
        (uri) => {
          resolve(uri as File);
        },
        'file',
      );
    });

  const resolveCid = async (bucketId: string) => {
    return await ddcClient.resolveName(BigInt(bucketId), 'fs', {
      cacheControl: 'no-cache',
    });
  };

  const copyToClipboard = async (params: { bucketId: string; cid: string; element: INode; token?: string }) => {
    const url = getUrl(params);
    await navigator.clipboard.writeText(url);
  };

  const getUrl = ({
    bucketId,
    cid,
    element,
    token,
  }: {
    bucketId: string;
    cid: string;
    element: INode;
    token?: string;
  }) =>
    `${DDC_STORAGE_NODE_URL}/${bucketId}/${cid}/${element.metadata?.fullPath}?source=developer-console${token ? `&token=${token}` : ''}`;

  const showLinkCopiedMessage = () => {
    showMessage({
      appearance: 'info',
      message: 'Link copied to clipboard. Share it with anyone you like!',
      placement: {
        vertical: 'top',
        horizontal: 'right',
      },
    });
  };

  return (
    <>
      <StyledRow locked={lockUi} open={isOpen} onClick={onRowClick}>
        <Typography variant="subtitle1" flex={1}>
          {row.bucketId}
        </Typography>
        <Box display="flex" alignItems="center" flex={1.5} justifyContent="end">
          {isOpen && (
            <>
              {/*    <IconButton*/}
              {/*      sx={{ marginRight: '8px' }}*/}
              {/*      onClick={(event) => {*/}
              {/*        event.stopPropagation();*/}
              {/*      }}*/}
              {/*    >*/}
              {/*      <DeleteIcon />*/}
              {/*    </IconButton>*/}
              <Button
                color="secondary"
                variant="outlined"
                startIcon={isDesktop && <AddCircleOutlinedIcon />}
                sx={{ marginRight: '8px' }}
                onClick={(event) => {
                  event.stopPropagation();
                  onFolderCreate(row.bucketId);
                }}
              >
                Create Folder
              </Button>
            </>
          )}
          <Typography variant="body2">{row.usedStorage}</Typography>
        </Box>
        <Typography variant="body2" flex={1} textAlign="center">
          {row.acl ? 'Public' : 'Private'}
        </Typography>
        <Box
          flex={1}
          textAlign="end"
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          {isOpen && (
            <UploadButton
              firstBucketLocked={firstBucketLocked}
              onDrop={onUpload}
              bucketId={row.bucketId}
              cnsName="fs"
              handleCreateEmptyFolder={onFolderCreate}
            />
          )}
        </Box>
      </StyledRow>
      {isOpen && (
        <ExpandedRow open={isOpen}>
          {uploadStatus !== 'idle' && bucketInProgress === row.bucketId && (
            <UploadStatus status={uploadStatus} type={uploadType} onClose={onCloseUpload} />
          )}
          <TreeView
            data={treeData}
            nodeRenderer={({ element, isBranch, isExpanded, getNodeProps, level, handleExpand }) => {
              const leftMargin = 40 * (level - 1);
              const isFileForEmptyFolder = element.name === `${EMPTY_FILE_NAME}`;
              return (
                <div
                  {...getNodeProps({ onClick: handleExpand })}
                  style={{
                    marginLeft: leftMargin,
                    padding: '12px',
                    display: isFileForEmptyFolder ? 'none' : 'flex',
                    alignItems: 'center',
                    width: 'calc(100% - ' + leftMargin + 'px)',
                  }}
                >
                  <Box flex={1} display="flex" alignItems="center" sx={{ '&:hover': { cursor: 'pointer' } }}>
                    {isBranch && (
                      <Box
                        display="flex"
                        marginRight="8px"
                        sx={{
                          transition: 'transform 0.2s',
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        }}
                      >
                        <ArrowRightIcon fontSize="small" />
                      </Box>
                    )}
                    <Box display="flex" marginRight="8px">
                      {isBranch ? <FilledFolderIcon /> : <FolderIcon />}
                    </Box>
                    <Typography variant="body2" flex={1}>
                      <Truncate text={element.name} variant="text" maxLength={15} endingLength={4} />
                    </Typography>
                  </Box>
                  {element.metadata?.usedStorage && (
                    <Typography
                      variant="body2"
                      flex={1.5}
                      textAlign="right"
                      marginRight={isBranch ? `${leftMargin}px` : 0}
                    >
                      {bytesToSize(Number(element.metadata.usedStorage))}
                    </Typography>
                  )}
                  <Typography variant="body2" flex={1} textAlign="center" marginRight={`${leftMargin}px`}>
                    {element.metadata?.isPublic ? 'Public' : 'Private'}
                  </Typography>
                  <Box
                    flex={1}
                    textAlign="right"
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    {!isBranch ? (
                      <ButtonGroup>
                        {element.metadata?.isImage && (
                          <ResizeDialogButton
                            handleSubmit={async (resolutions: ResolutionEntry[]) => {
                              await onResizeSubmit(row.bucketId, element, resolutions);
                            }}
                          ></ResizeDialogButton>
                        )}
                        <IconButton sx={{ marginRight: '8px' }} onClick={async () => handleCopyLink({ row, element })}>
                          <ShareIcon />
                        </IconButton>
                        <IconButton
                          onClick={async (event) => {
                            event.preventDefault();
                            await handleDownload({ bucketId: row.bucketId, element });
                          }}
                        >
                          <DownloadIcon />
                        </IconButton>
                        {downloadingNodeId === element.id ? (
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                              marginLeft: '10px',
                              marginRight: '10px',
                            }}
                          >
                            <CircularProgress size={20} />
                          </Box>
                        ) : null}
                      </ButtonGroup>
                    ) : (
                      <UploadButton
                        bucketId={row.bucketId}
                        cnsName={element.name}
                        filePath={
                          element.metadata!.type === 'folder' ? (element?.metadata?.fullPath as string) : element.name
                        }
                        onDrop={onUpload}
                        handleCreateEmptyFolder={onFolderCreate}
                      />
                    )}
                  </Box>
                </div>
              );
            }}
          />
        </ExpandedRow>
      )}
    </>
  );
};
