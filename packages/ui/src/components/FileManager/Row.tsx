import { useState } from 'react';
import { Box, ButtonGroup, Typography } from '@mui/material';
import { ButtonIcon, UploadButton } from '@developer-console/ui';
import { ArrowIcon, DownloadIcon, FilledFolderIcon, FolderIcon, ShareIcon } from '../../icons';
import TreeView, { flattenTree } from 'react-accessible-treeview';
import { useMessages } from '../../hooks';

export const Row = ({ row }: { row: any }) => {
  const [open, setOpen] = useState(false);

  const { showMessage } = useMessages();

  const treeData = flattenTree(row.files);

  return (
    <>
      <Box
        sx={{
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
          backgroundColor: open ? '#FFFFFF' : 'transparent',
          border: open ? '1px solid #5865F2' : 'none',
          borderBottom: open ? '1px solid #CDCCCD' : 'none',
          borderRadius: open ? '4px 4px 0 0 ' : 'none',
        }}
        onClick={() => setOpen(!open)}
      >
        <Typography variant="body2" sx={{ flex: 1 }}>
          {row.bucketId}
        </Typography>
        <Typography variant="body2" sx={{ flex: 1, textAlign: 'right' }}>
          {row.usedStorage}
        </Typography>
        <Typography variant="body2" sx={{ flex: 1, textAlign: 'center' }}>
          {row.acl}
        </Typography>
        <Box sx={{ flex: 1 }}></Box>
      </Box>
      {open && (
        <Box
          sx={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #5865F2',
            borderTop: 'none',
            borderRadius: '0 0 4px 4px',
            boxShadow: '0px 8px 12px 0px #1A0A7C1A',
            maxHeight: '352px',
            overflowY: 'auto',
            width: '100%',
          }}
        >
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
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', '&:hover': { cursor: 'pointer' } }}>
                    {isBranch && (
                      <Box
                        sx={{
                          display: 'flex',
                          transition: 'transform 0.2s',
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          marginRight: '8px',
                        }}
                      >
                        <ArrowIcon width="16px" height="16px" />
                      </Box>
                    )}
                    <Box display="flex" marginRight="8px">
                      {isBranch ? <FilledFolderIcon /> : <FolderIcon />}
                    </Box>
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {element.name}
                    </Typography>
                  </Box>
                  {element.metadata?.usedStorage && (
                    <Typography
                      variant="body2"
                      sx={{ flex: 1, textAlign: 'right', marginRight: isBranch ? `${leftMargin}px` : 0 }}
                    >
                      {element.metadata.usedStorage}
                    </Typography>
                  )}
                  {element.metadata?.type && (
                    <Typography variant="body2" sx={{ flex: 1, textAlign: 'center', marginRight: `${leftMargin}px` }}>
                      {element.metadata.type}
                    </Typography>
                  )}
                  <Box sx={{ flex: 1, textAlign: 'right' }}>
                    {!isBranch ? (
                      <ButtonGroup>
                        <ButtonIcon
                          sx={{ marginRight: '8px' }}
                          icon={<ShareIcon />}
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
                        />
                        <ButtonIcon icon={<DownloadIcon />} />
                      </ButtonGroup>
                    ) : (
                      <UploadButton />
                    )}
                  </Box>
                </div>
              );
            }}
          />
        </Box>
      )}
    </>
  );
};
