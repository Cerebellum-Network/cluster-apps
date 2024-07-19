import { useState } from 'react';
import { Box, BoxProps, ButtonGroup, IconButton, styled, Typography } from '@mui/material';
import { UploadButton, ArrowRightIcon } from '@developer-console/ui';
import { DownloadIcon, FilledFolderIcon, FolderIcon, ShareIcon } from '../../icons';
import TreeView, { flattenTree } from 'react-accessible-treeview';
import { useMessages } from '../../hooks';

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
    backgroundColor: '#7A9FFF0A',
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

export const Row = ({ row }: { row: any }) => {
  const [open, setOpen] = useState(false);

  const { showMessage } = useMessages();

  const treeData = flattenTree(row.files);

  return (
    <>
      <StyledRow open={open} onClick={() => setOpen(!open)}>
        <Typography variant="body2" flex={1}>
          {row.bucketId}
        </Typography>
        <Typography variant="body2" flex={1} textAlign="right">
          {row.usedStorage}
        </Typography>
        <Typography variant="body2" flex={1} textAlign="center">
          {row.acl}
        </Typography>
        <Box flex={1}></Box>
      </StyledRow>
      {open && (
        <ExpandedRow open={open}>
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
                      {element.metadata.usedStorage} KB
                    </Typography>
                  )}
                  {element.metadata?.type && (
                    <Typography variant="body2" flex={1} textAlign="center" marginRight={`${leftMargin}px`}>
                      {element.metadata.type}
                    </Typography>
                  )}
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
                          onClick={() => {
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
                        <IconButton>
                          <DownloadIcon />
                        </IconButton>
                      </ButtonGroup>
                    ) : (
                      <UploadButton />
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
