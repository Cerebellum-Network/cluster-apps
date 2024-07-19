import { useState } from 'react';
import { MenuItem, MenuList, styled } from '@mui/material';
import { Dropdown, UploadFileIcon, UploadFolderIcon } from '@developer-console/ui';

const StyledMenuItem = styled(MenuItem)(() => ({
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
  '.muimenuitem-root:hover': {
    backgroundColor: '#CBCFFB',
  },
}));

export const UploadButton = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dropdown open={open} onToggle={setOpen} label="Upload">
      <MenuList>
        <StyledMenuItem
          onClick={(event) => {
            event.stopPropagation();
          }}
          disableRipple
        >
          <UploadFileIcon width="12px" height="12px" /> Upload File
        </StyledMenuItem>
        <StyledMenuItem
          onClick={(event) => {
            event.stopPropagation();
          }}
          disableRipple
        >
          <UploadFolderIcon fontSize="small" /> Upload Folder
        </StyledMenuItem>
      </MenuList>
    </Dropdown>
  );
};
