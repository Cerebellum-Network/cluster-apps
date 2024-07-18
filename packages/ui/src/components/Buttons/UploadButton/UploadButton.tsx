import { useState } from 'react';
import { Box, MenuItem, MenuList, styled } from '@mui/material';
import { Dropdown, FileIcon } from '@developer-console/ui';

const StyledMenuItem = styled(MenuItem)(() => ({
  '.muimenuitem-root:hover': {
    backgroundColor: '#CBCFFB',
  },
}));

export const UploadButton = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dropdown sx={{ '.MuiPaper-root': { padding: '8px' } }} open={open} onToggle={setOpen} label="Upload">
      <MenuList>
        <StyledMenuItem
          onClick={(event) => {
            event.stopPropagation();
          }}
          disableRipple
        >
          <Box>
            <FileIcon width="12px" height="12px" /> Upload File
          </Box>
        </StyledMenuItem>
        <StyledMenuItem
          onClick={(event) => {
            event.stopPropagation();
          }}
          disableRipple
        >
          <Box>
            <FileIcon width="12px" height="12px" /> Upload Folder
          </Box>
        </StyledMenuItem>
      </MenuList>
    </Dropdown>
  );
};
