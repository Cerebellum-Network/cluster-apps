import { useState } from 'react';
import { ListItemIcon, MenuItem, MenuList, Typography } from '@mui/material';
import { Dropdown, UploadFileIcon } from '@developer-console/ui';

interface UploadComponentProps {
  onDrop: (values: { acceptedFiles: File[]; bucketId: string; cnsName: string; isFolder: boolean }) => void;
  bucketId: string;
  cnsName: string;
}

export const UploadButton = ({ bucketId, cnsName, onDrop }: UploadComponentProps) => {
  const [openDropdown, setOpen] = useState(false);

  const handleUploadFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e: any) => {
      const files = Array.from(e.target.files) as File[];
      onDrop({ acceptedFiles: files, bucketId, cnsName, isFolder: false });
    };
    input.click();
    setOpen((prevState) => !prevState);
  };

  // @TODO uncomment when folder uploading will be ready
  // const handleUploadFolder = () => {
  //   const input = document.createElement('input');
  //   input.type = 'file';
  //   input.webkitdirectory = true;
  //   input.multiple = true;
  //   input.onchange = (e: Event) => {
  //     const target = e.target as HTMLInputElement;
  //     const files = Array.from(target.files || []);
  //     onDrop({ acceptedFiles: files, bucketId, cnsName, isFolder: true });
  //   };
  //   input.click();
  //   setOpen((prevState) => !prevState);
  // };

  return (
    <Dropdown open={openDropdown} onToggle={setOpen} label="Upload">
      {/*<div {...getRootProps()}>*/}
      <MenuList>
        <MenuItem
          onClick={(event) => {
            event.stopPropagation();
            handleUploadFile();
          }}
          disableRipple
        >
          <ListItemIcon>
            <UploadFileIcon fontSize="small" />
          </ListItemIcon>
          <Typography>Upload File</Typography>
        </MenuItem>
        {/*@TODO uncomment when folder uploading will be ready*/}
        {/*<MenuItem*/}
        {/*  onClick={(event) => {*/}
        {/*    event.stopPropagation();*/}
        {/*    handleUploadFolder();*/}
        {/*  }}*/}
        {/*  disableRipple*/}
        {/*>*/}
        {/*  <ListItemIcon>*/}
        {/*    <UploadFolderIcon fontSize="small" />*/}
        {/*  </ListItemIcon>*/}
        {/*  <Typography>Upload Folder</Typography>*/}
        {/*</MenuItem>*/}
      </MenuList>
    </Dropdown>
  );
};
