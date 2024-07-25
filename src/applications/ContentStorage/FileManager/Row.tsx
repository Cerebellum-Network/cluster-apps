import { Box, BoxProps, ButtonGroup, IconButton, styled, Typography } from '@mui/material';
import { ArrowRightIcon } from '@developer-console/ui';
import { DownloadIcon, FilledFolderIcon, FolderIcon, ShareIcon, useMessages } from '@developer-console/ui';
import TreeView, { flattenTree } from 'react-accessible-treeview';
import { RowData } from './types.ts';
import { bytesToSize } from './helpers.ts';
import { DDC_STORAGE_NODE_URL } from '~/constants.ts';
import { UploadStatus } from './UploadStatus.tsx';
import { UploadButton } from './UploadButton.tsx';

interface StyledRowProps extends BoxProps {
  open: boolean;
}
const StyledRow = styled(Box)<StyledRowProps>(({ theme, open }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: '16px 12px',
  '&:hover': {
    cursor: 'pointer',
    backgroundColor: '#7A9FFF0A',
  },
  '&:nth-child(odd)': {
    backgroundColor: open ? theme.palette.common.white : '#7A9FFF0A',
  },
  backgroundColor: open ? theme.palette.common.white : 'transparent',
  border: open ? `1px solid ${theme.palette.divider}` : 'none',
  borderBottom: open ? `1px solid ${theme.palette.divider}` : 'none',
  borderRadius: open ? theme.spacing(0.5, 0.5, 0, 0) : 'none',
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
  onFileDownload,
}: {
  row: RowData;
  onUpload: (values: { acceptedFiles: File[]; bucketId: string; cnsName: string; isFolder: boolean }) => void;
  uploadStatus: 'idle' | 'uploading' | 'success' | 'error';
  uploadType: 'file' | 'folder';
  isOpen: boolean;
  onRowClick: () => void;
  onCloseUpload: () => void;
  onFileDownload: (bucketId: string, source: string, name: string) => void;
}) => {
  const { showMessage } = useMessages();

  const treeData = flattenTree(row.files);

  return (
    <>
      <StyledRow open={isOpen} onClick={onRowClick}>
        <Typography variant="body2" flex={1}>
          {row.bucketId}
        </Typography>
        <Box display="flex" alignItems="center" flex={1} justifyContent="end">
          {/*{isOpen && (*/}
          {/*  <>*/}
          {/*    <IconButton*/}
          {/*      sx={{ marginRight: '8px' }}*/}
          {/*      onClick={(event) => {*/}
          {/*        event.stopPropagation();*/}
          {/*      }}*/}
          {/*    >*/}
          {/*      <DeleteIcon />*/}
          {/*    </IconButton>*/}
          {/*    <Button*/}
          {/*      size="small"*/}
          {/*      sx={{ marginRight: '8px' }}*/}
          {/*      onClick={(event) => {*/}
          {/*        event.stopPropagation();*/}
          {/*      }}*/}
          {/*    >*/}
          {/*      <AddCircleOutlinedIcon />*/}
          {/*      Create Folder*/}
          {/*    </Button>*/}
          {/*  </>*/}
          {/*)}*/}
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
          {isOpen && <UploadButton onDrop={onUpload} bucketId={row.bucketId} cnsName="fs" />}
        </Box>
      </StyledRow>
      {isOpen && (
        <ExpandedRow open={isOpen}>
          {uploadStatus !== 'idle' && <UploadStatus status={uploadStatus} type={uploadType} onClose={onCloseUpload} />}
          <TreeView
            data={treeData}
            nodeRenderer={({ element, isBranch, isExpanded, getNodeProps, level, handleExpand }) => {
              const leftMargin = 40 * (level - 1);
              return (
                <div
                  {...getNodeProps({ onClick: handleExpand })}
                  style={{
                    marginLeft: leftMargin,
                    padding: '12px',
                    display: 'flex',
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
                      {element.name}
                    </Typography>
                  </Box>
                  {element.metadata?.usedStorage && (
                    <Typography
                      variant="body2"
                      flex={1}
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
                            console.log(element);
                            await navigator.clipboard.writeText(
                              `${DDC_STORAGE_NODE_URL}/${row.bucketId}/${element.metadata?.cid}`,
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
                          onClick={() => {
                            onFileDownload(row.bucketId, element.metadata?.cid as unknown as string, element.name);
                          }}
                        >
                          <DownloadIcon />
                        </IconButton>
                      </ButtonGroup>
                    ) : (
                      <UploadButton bucketId={row.bucketId} cnsName={element.name} onDrop={onUpload} />
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
