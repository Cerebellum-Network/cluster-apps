import { useState } from 'react';
import { ListItemIcon, MenuItem, MenuList, Typography } from '@mui/material';
import { Dropdown, UploadFileIcon, UploadFolderIcon } from '@developer-console/ui';
import { AnalyticsId, trackEvent } from '@developer-console/analytics';

interface UploadComponentProps {
  onDrop: (values: {
    acceptedFiles: File[];
    bucketId: string;
    cnsName: string;
    isFolder: boolean;
    filePath?: string;
  }) => void;
  bucketId: string;
  cnsName: string;
  filePath?: string;
}

export const UploadButton = ({ bucketId, filePath, onDrop }: UploadComponentProps) => {
  const [openDropdown, setOpen] = useState(false);

  const handleUploadFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e: any) => {
      const files = Array.from(e.target.files) as File[];
      onDrop({ acceptedFiles: files, bucketId, cnsName: 'fs', isFolder: false, filePath });
    };
    input.click();
    setOpen((prevState) => !prevState);
  };

  const handleUploadFolder = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.multiple = true;
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const files = Array.from(target.files || []);
      onDrop({ acceptedFiles: files, bucketId, cnsName: 'fs', isFolder: true, filePath });
    };
    input.click();
    setOpen((prevState) => !prevState);
  };

  return (
    <Dropdown open={openDropdown} onToggle={setOpen} label="Upload">
      <MenuList>
        <MenuItem
          onClick={(event) => {
            event.stopPropagation();
            trackEvent(AnalyticsId.uploadFileBucket);
            handleUploadFile();
          }}
          disableRipple
        >
          <ListItemIcon>
            <UploadFileIcon fontSize="small" />
          </ListItemIcon>
          <Typography className={AnalyticsId.uploadFileBucket}>Upload File</Typography>
        </MenuItem>
        <MenuItem
          onClick={(event) => {
            event.stopPropagation();
            trackEvent(AnalyticsId.uploadFolderBucket);
            handleUploadFolder();
          }}
          disableRipple
        >
          <ListItemIcon>
            <UploadFolderIcon fontSize="small" />
          </ListItemIcon>
          <Typography className={AnalyticsId.uploadFolderBucket}>Upload Folder</Typography>
        </MenuItem>
      </MenuList>
    </Dropdown>
  );
};
