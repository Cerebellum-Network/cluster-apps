import { useState } from 'react';
import { ListItemIcon, MenuItem, MenuList, styled, Typography } from '@mui/material';
import { Dropdown, UploadFileIcon, UploadFolderIcon } from '@developer-console/ui';

export const UploadButton = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dropdown open={open} onToggle={setOpen} label="Upload">
      <MenuList>
        <MenuItem
          onClick={(event) => {
            event.stopPropagation();
          }}
          disableRipple
        >
          <ListItemIcon>
            <UploadFileIcon fontSize="small" />
          </ListItemIcon>
          <Typography>Upload File</Typography>
        </MenuItem>
        <MenuItem
          onClick={(event) => {
            event.stopPropagation();
          }}
          disableRipple
        >
          <ListItemIcon>
            <UploadFolderIcon fontSize="small" />
          </ListItemIcon>
          <Typography>Upload Folder</Typography>
        </MenuItem>
      </MenuList>
    </Dropdown>
  );
};
