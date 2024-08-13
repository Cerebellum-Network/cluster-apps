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
  Delete as DeleteIcon,
  AddCircleOutlineOutlined as AddCircleOutlinedIcon,
  Close as CloseIcon,
  GppMaybeOutlined as WarningIcon,
  CheckOutlined as CheckIcon,
  EmojiEventsOutlined as RewardIcon,
  CheckCircle as CheckCircleIcon,
  KeyboardArrowDownOutlined as ArrowDownIcon,
  KeyboardArrowUpOutlined as ArrowUpIcon,
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
export * from './CloudFlashIcon';
export * from './BarTrackingIcon';
export * from './DecentralizedServerIcon';
export * from './GithubLogoIcon';
export * from './ClockIcon';
export * from './AvatarIcon';
