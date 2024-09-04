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
} from '@developer-console/ui';
import { DownloadIcon, FilledFolderIcon, FolderIcon, ShareIcon, useMessages } from '@developer-console/ui';
import TreeView, { flattenTree } from 'react-accessible-treeview';
import { RowData } from './types.ts';
import { bytesToSize } from './helpers.ts';
import { DDC_STORAGE_NODE_URL, EMPTY_FILE_NAME } from '~/constants.ts';
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
  onFolderCreate: (bucketId: string) => void;
}) => {
  const account = useAccount();

  const ddcClient = account.ddc;
  const { showMessage } = useMessages();

  const isDesktop = useIsDesktop();

  const treeData = flattenTree(row.files);

  const handleDownload = async (downloadUrl: string, elName: string) => {
    try {
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = elName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download error:', error);
    }
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
            />
          )}
        </Box>
      </StyledRow>
      {isOpen && (
        <ExpandedRow open={isOpen}>
          {uploadStatus !== 'idle' && <UploadStatus status={uploadStatus} type={uploadType} onClose={onCloseUpload} />}
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
                        <IconButton
                          sx={{ marginRight: '8px' }}
                          onClick={async () => {
                            const cid = await ddcClient.resolveName(BigInt(row.bucketId), 'fs', {
                              cacheControl: 'no-cache',
                            });
                            await navigator.clipboard.writeText(
                              `${DDC_STORAGE_NODE_URL}/${row.bucketId}/${cid}/${element.metadata?.fullPath}`,
                            );
                            showMessage({
                              appearance: 'info',
                              message: 'Link copied to clipboard. Share it with anyone you like!',
                              placement: {
                                vertical: 'top',
                                horizontal: 'right',
                              },
                            });
                          }}
                        >
                          <ShareIcon />
                        </IconButton>
                        <IconButton
                          onClick={async (event) => {
                            event.preventDefault();
                            const cid = await ddcClient.resolveName(BigInt(row.bucketId), 'fs', {
                              cacheControl: 'no-cache',
                            });
                            await handleDownload(
                              `${DDC_STORAGE_NODE_URL}/${row.bucketId}/${cid}/${element.metadata?.fullPath}`,
                              element.name,
                            );
                          }}
                        >
                          <DownloadIcon />
                        </IconButton>
                      </ButtonGroup>
                    ) : (
                      <UploadButton
                        bucketId={row.bucketId}
                        cnsName={element.name}
                        filePath={
                          element.metadata!.type === 'folder' ? (element?.metadata?.fullPath as string) : element.name
                        }
                        onDrop={onUpload}
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
