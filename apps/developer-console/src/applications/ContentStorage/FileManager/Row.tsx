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
import { EMPTY_FILE_NAME } from '~/constants.ts';
import { UploadStatus } from './UploadStatus.tsx';
import { UploadButton } from './UploadButton.tsx';
import { useAccount } from '~/hooks';

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
  }) => void;
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

  const { showMessage } = useMessages();

  const isDesktop = useIsDesktop();

  const treeData = flattenTree(row.files);

  const [downloadingNodeId, setDownloadingNodeId] = useState<INode['id'] | null>(null);

  /** The object key (full path within the bucket) for a tree node. */
  const keyOf = (element: INode) => (element.metadata?.fullPath as string) || element.name;

  const handleDownload = async ({ bucketId, element }: { bucketId: string; element: INode }) => {
    try {
      setDownloadingNodeId(element.id);
      // Reads through the gateway with the wallet's credential, so it works for
      // both public and private objects.
      const blob = await account.storage.readObject(bucketId, keyOf(element));
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
      showMessage({
        appearance: 'error',
        message: 'Failed to download the file. Please try again.',
        placement: { vertical: 'top', horizontal: 'right' },
      });
    } finally {
      setDownloadingNodeId(null);
    }
  };

  const handleCopyLink = async ({ row, element }: { row: RowData; element: INode }) => {
    try {
      // Public CDN/gateway URL. For a private object the link resolves only for a
      // holder of the bucket's credential; share is primarily for public buckets.
      const url = account.storage.publicUrl(row.bucketId, keyOf(element));
      await navigator.clipboard.writeText(url);
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
        <Typography variant="subtitle1" flex={1} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
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
                    <Box
                      marginLeft="8px"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText((element.metadata?.cid as string) || '');
                        showMessage({
                          appearance: 'success',
                          message: 'CID was copied successfully!',
                          placement: { vertical: 'top', horizontal: 'right' },
                          autoDismiss: true,
                        });
                      }}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '6px 6px',
                        borderRadius: '6px',
                        backgroundColor: '#f5f5f5',
                        whiteSpace: 'nowrap',
                        '&:hover': {
                          backgroundColor: '#e0e0e0',
                          cursor: 'pointer',
                        },
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" height={18} viewBox="0 0 24 24" width={18} fill={'#555'}>
                        <path d="M0 0h24v24H0z" fill="none" />
                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 18H8V7h11v16z" />
                      </svg>
                      <Typography variant="caption">Copy CID</Typography>
                    </Box>
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
