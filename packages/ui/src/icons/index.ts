/**
 * Export only required set of icon from MUI, so we know what is used from the library and what is not.
 * Add `*Icon` to the icon component name
 */

export type { IconProps } from '@mui/material';

// MUI icons

export {
  Menu as MenuIcon,
  ArrowForward as ArrowForwardIcon,
  InfoOutlined as InfoOutlinedIcon,
  ArrowRight as ArrowRightIcon,
} from '@mui/icons-material';

// Custom icons

export * from './CereIcon';
export * from './DiscordIcon';
export * from './FilledFolderIcon';
export * from './FolderIcon';
export * from './ShareIcon';
export * from './DownloadIcon';
export * from './ActivityAppIcon';
export * from './StorageAppIcon';
export * from './UploadFileIcon';
export * from './UploadFolderIcon';
export * from './ArrowLeft';
export * from './ArrowRight';
