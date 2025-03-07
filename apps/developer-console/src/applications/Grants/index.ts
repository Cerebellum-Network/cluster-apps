import React from 'react';
import { Application } from '../types';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import Grants from './Grants';

/**
 * Creates a custom icon component with gold gradient styling for the Grants & Bounties section
 * This gives the icon a distinctive gold appearance in the navigation bar
 */
const GoldGradientIcon = () => {
  return React.createElement(EmojiEventsIcon, {
    sx: {
      background: 'linear-gradient(45deg, #FFD700 30%, #FFA500 90%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      textFillColor: 'transparent',
      fontSize: '24px'
    }
  });
};

/**
 * Grants application configuration
 * This defines how the Grants & Bounties section appears in the application
 */
const grants: Application = {
  rootPath: 'grants',
  rootComponent: Grants,
  title: 'Grants & Bounties',
  description: 'Contribute to the Cere ecosystem and earn rewards',
  icon: React.createElement(GoldGradientIcon),
};

export default grants; 