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
} from '@mui/icons-material';

// Custom icons

export * from './CereIcon';
export * from './DiscordIcon';
export * from './ActivityAppIcon';
export * from './CdnAppIcon';
export * from './StorageAppIcon';
