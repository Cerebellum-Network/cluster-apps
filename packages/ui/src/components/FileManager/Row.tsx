import { useState } from 'react';
import { Box, ButtonGroup, Typography } from '@mui/material';
import { ButtonIcon, UploadButton } from '@developer-console/ui';
import { ArrowIcon, DownloadIcon, FilledFolderIcon, FolderIcon, ShareIcon } from '../../icons';
import TreeView, { flattenTree } from 'react-accessible-treeview';

export const Row = ({ row }: { row: any }) => {
  const [open, setOpen] = useState(false);

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
            border: '1px solid #5865F2',
            borderRadius: '4px',
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
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                    {isBranch && (
                      <Box
                        sx={{
                          display: 'inline-block',
                          transition: 'transform 0.2s',
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          marginRight: '8px',
                        }}
                      >
                        <ArrowIcon width="16px" height="16px" />
                      </Box>
                    )}

                    {isBranch ? <FilledFolderIcon /> : <FolderIcon />}

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
                        <ButtonIcon sx={{ marginRight: '8px' }} icon={<ShareIcon />} />
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
