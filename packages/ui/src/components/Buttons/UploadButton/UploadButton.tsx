import { useState } from 'react';
import { Box, MenuItem, MenuList, styled } from '@mui/material';
import { Dropdown, FileIcon } from '@developer-console/ui';

const StyledMenuItem = styled(MenuItem)`
  '.muimenuitem-root:hover': {
    background-color: '#CBCFFB';
  }
`;

export const UploadButton = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dropdown open={open} onToggle={setOpen} label="Upload">
      <Box>
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
          <MenuItem
            onClick={(event) => {
              event.stopPropagation();
            }}
            disableRipple
          >
            <Box>
              <FileIcon width="12px" height="12px" /> Upload Folder
            </Box>
          </MenuItem>
        </MenuList>
      </Box>
    </Dropdown>
  );
};
