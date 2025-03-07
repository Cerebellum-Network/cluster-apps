import { useState, useRef } from 'react';
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
  MenuItem,
  FormControl,
  useMessages,
  LoadingButton,
  TextField,
  Tooltip,
} from '@cluster-apps/ui';
import { 
  DownloadIcon, 
  FilledFolderIcon, 
  FolderIcon, 
  ShareIcon,
  EditIcon,
  CheckIcon,
  CloseIcon,
} from '@cluster-apps/ui';
import { Visibility as VisibilityIcon, VisibilityOff as VisibilityOffIcon } from '@mui/icons-material';
import TreeView, { flattenTree, INode } from 'react-accessible-treeview';
import { RowData } from './types.ts';
import { bytesToSize } from './helpers.ts';
import { DDC_STORAGE_NODE_URL, EMPTY_FILE_NAME } from '~/constants.ts';
import { UploadStatus } from './UploadStatus.tsx';
import { UploadButton } from './UploadButton.tsx';
import { useAccount, useBucketNames, useHiddenBuckets } from '~/hooks';

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

const StyledSelect = styled(TextField)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  minWidth: '100px',
  '& .MuiOutlinedInput-root': {
    height: '32px',
    backgroundColor: theme.palette.background.paper,
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: theme.palette.mode === 'dark' 
        ? theme.palette.grey[700] 
        : theme.palette.grey[300],
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: theme.palette.primary.main,
    },
  },
  '& .MuiSelect-select': {
    padding: '4px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.875rem',
    backgroundColor: 'transparent',
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: theme.palette.divider,
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
  onAccessChange,
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
  onAccessChange?: (bucketId: string, isPublic: boolean) => Promise<void>;
}) => {
  const account = useAccount();
  const { showMessage } = useMessages();
  const ddcClient = account.ddc;
  const isDesktop = useIsDesktop();
  const treeData = flattenTree(row.files);
  const [downloadingNodeId, setDownloadingNodeId] = useState<INode['id'] | null>(null);
  const [isSavingAccess, setIsSavingAccess] = useState(false);
  const [access, setAccess] = useState<'public' | 'private'>(row.acl ? 'public' : 'private');
  
  // Bucket naming functionality
  const { getBucketName, setBucketName } = useBucketNames();
  const [isRenaming, setIsRenaming] = useState(false);
  const [bucketNameInput, setBucketNameInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Bucket visibility functionality
  const { isBucketHidden, toggleBucketVisibility } = useHiddenBuckets();
  const isHidden = isBucketHidden(row.bucketId);
  
  const handleStartRenaming = (event: React.MouseEvent) => {
    event.stopPropagation();
    setBucketNameInput(getBucketName(row.bucketId));
    setIsRenaming(true);
    // Focus the input after rendering
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };
  
  const handleCancelRenaming = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsRenaming(false);
  };
  
  const handleSaveRenaming = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (bucketNameInput.trim()) {
      setBucketName(row.bucketId, bucketNameInput.trim());
      showMessage({
        appearance: 'success',
        message: 'Bucket name updated',
        placement: {
          vertical: 'top',
          horizontal: 'right',
        },
      });
    }
    setIsRenaming(false);
  };
  
  const handleNameInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setBucketNameInput(event.target.value);
  };
  
  const handleNameInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (bucketNameInput.trim()) {
        setBucketName(row.bucketId, bucketNameInput.trim());
        showMessage({
          appearance: 'success',
          message: 'Bucket name updated',
          placement: {
            vertical: 'top',
            horizontal: 'right',
          },
        });
        setIsRenaming(false);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setIsRenaming(false);
    }
  };

  const handleDownload = async ({ bucketId, element }: { bucketId: string; element: INode }) => {
    try {
      const cid = (await resolveCid(bucketId))?.toString();
      const tokenCid = cid; // TODO: use file seed instead when DDC supports it: element.metadata?.cid as string;
      const token = element.metadata?.isPublic ? undefined : await account.createAuthToken(BigInt(bucketId), tokenCid);

      const downloadUrl = getUrl({ bucketId, cid, element, token: token?.toString() });
      const response = await fetch(downloadUrl);

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

  const handleAccessChange = async (event: React.ChangeEvent<{ value: unknown }>) => {
    if (!onAccessChange) return;
    
    const newValue = event.target.value as 'public' | 'private';
    setAccess(newValue);
    setIsSavingAccess(true);
    
    try {
      await onAccessChange(row.bucketId, newValue === 'public');
      showMessage({
        appearance: 'success',
        message: 'Bucket access has been updated',
        placement: {
          vertical: 'top',
          horizontal: 'right',
        },
      });
    } catch (error) {
      console.error('Failed to update bucket access:', error);
      showMessage({
        appearance: 'error',
        message: 'Failed to update bucket access. Please try again.',
        placement: {
          vertical: 'top',
          horizontal: 'right',
        },
      });
      // Revert to previous value
      setAccess(row.acl ? 'public' : 'private');
    } finally {
      setIsSavingAccess(false);
    }
  };

  const handleToggleVisibility = (event: React.MouseEvent) => {
    event.stopPropagation();
    toggleBucketVisibility(row.bucketId);
    showMessage({
      appearance: 'success',
      message: isHidden ? 'Bucket is now visible' : 'Bucket is now hidden',
      placement: {
        vertical: 'top',
        horizontal: 'right',
      },
    });
  };

  return (
    <>
      <StyledRow locked={lockUi} open={isOpen} onClick={onRowClick}>
        <Box flex={1} display="flex" alignItems="center">
          {isRenaming ? (
            <Box display="flex" alignItems="center" onClick={(e) => e.stopPropagation()}>
              <TextField
                inputRef={inputRef}
                value={bucketNameInput}
                onChange={handleNameInputChange}
                onKeyDown={handleNameInputKeyDown}
                size="small"
                autoFocus
                placeholder="Enter bucket name"
                sx={{ 
                  width: '180px',
                  mr: 1,
                  '& .MuiOutlinedInput-root': {
                    height: '32px',
                  }
                }}
              />
              <IconButton 
                size="small" 
                color="primary" 
                onClick={handleSaveRenaming}
                sx={{ mr: 0.5 }}
              >
                <CheckIcon fontSize="small" />
              </IconButton>
              <IconButton 
                size="small" 
                onClick={handleCancelRenaming}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          ) : (
            <>
              <Box display="flex" alignItems="center">
                <Typography variant="subtitle1" sx={{ mr: 1 }}>
                  {getBucketName(row.bucketId)}
                </Typography>
                <Tooltip title="Rename bucket">
                  <IconButton 
                    size="small" 
                    onClick={handleStartRenaming}
                    sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={isHidden ? "Show bucket" : "Hide bucket"}>
                  <IconButton 
                    size="small" 
                    onClick={handleToggleVisibility}
                    sx={{ opacity: 0.7, '&:hover': { opacity: 1 }, ml: 0.5 }}
                  >
                    {isHidden ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
              </Box>
              <Typography 
                variant="caption" 
                color="text.secondary" 
                sx={{ ml: 1 }}
              >
                ID: {row.bucketId}
              </Typography>
            </>
          )}
        </Box>
        <Box display="flex" alignItems="center" flex={1.5} justifyContent="end">
          {isOpen && (
            <>
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
        <Box flex={1} textAlign="center" onClick={(event) => event.stopPropagation()}>
          {onAccessChange ? (
            <Box display="flex" alignItems="center" justifyContent="center">
              <StyledSelect
                select
                value={access}
                onChange={handleAccessChange}
                disabled={isSavingAccess || lockUi}
                variant="outlined"
                size="small"
                InputProps={{
                  sx: { borderRadius: 1 }
                }}
                SelectProps={{
                  MenuProps: {
                    anchorOrigin: {
                      vertical: 'bottom',
                      horizontal: 'center',
                    },
                    transformOrigin: {
                      vertical: 'top',
                      horizontal: 'center',
                    },
                    PaperProps: {
                      sx: {
                        borderRadius: 1,
                        mt: 0.5,
                      }
                    }
                  }
                }}
                sx={{ m: 0 }}
              >
                <MenuItem value="public">Public</MenuItem>
                <MenuItem value="private">Private</MenuItem>
              </StyledSelect>
              {isSavingAccess && (
                <CircularProgress size={16} sx={{ ml: 1 }} />
              )}
            </Box>
          ) : (
            <Typography variant="body2">
              {row.acl ? 'Public' : 'Private'}
            </Typography>
          )}
        </Box>
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
