import { useState } from 'react';
import { ListItemIcon, MenuItem, MenuList, Typography } from '@mui/material';
import { Dropdown, UploadFileIcon, UploadFolderIcon, DropdownAnchor } from '@cluster-apps/ui';
import { AnalyticsId, trackEvent } from '@cluster-apps/analytics';

import { QuestHint } from '~/components';
import { useQuestsStore } from '~/hooks';
import { FEATURE_USER_ONBOARDING } from '../../../constants';

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
  firstBucketLocked?: boolean;
  filePath?: string;
  handleCreateEmptyFolder: (bucketId: string, name?: string) => Promise<void>;
}

export const UploadButton = ({
  bucketId,
  filePath,
  firstBucketLocked,
  onDrop,
  handleCreateEmptyFolder,
}: UploadComponentProps) => {
  const store = useQuestsStore();

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

  const handleUploadFolder = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        const directoryHandle = await (window as any)?.showDirectoryPicker();

        let hasFiles = false;

        for await (const entry of directoryHandle.values()) {
          if (entry.kind === 'file') {
            hasFiles = true;
          }
        }

        if (!hasFiles) {
          await handleCreateEmptyFolder(bucketId, directoryHandle.name);
        } else {
          uploadFolderWithInput();
        }
      } catch (error) {
        console.error('Error selecting directory:', error);
      }
    } else {
      uploadFolderWithInput();
    }
  };

  const uploadFolderWithInput = () => {
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

  const isCompleted = store.isCompleted('uploadFile');

  return (
    <Dropdown
      variant="button"
      open={openDropdown}
      onToggle={setOpen}
      renderAnchor={(props) => (
        <QuestHint
          quest="uploadFile"
          step="startUploading"
          position="left"
          title="Ready to Upload?"
          content={
            FEATURE_USER_ONBOARDING
              ? 'Your bucket is ready. Add your first file/folder to get your first 50 CERE tokens'
              : 'Your bucket is ready. Upload your first file/folder'
          }
          skip={!firstBucketLocked || isCompleted}
        >
          <DropdownAnchor label="Upload" {...props} />
        </QuestHint>
      )}
    >
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
