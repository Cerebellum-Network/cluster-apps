import React from 'react';
import { IconButton, Tooltip, useTheme } from '@mui/material';
import { Brightness4 as DarkModeIcon, Brightness7 as LightModeIcon } from '@mui/icons-material';
import { useThemeContext } from '../../theme';

export interface DarkModeToggleProps {
  className?: string;
}

export const DarkModeToggle: React.FC<DarkModeToggleProps> = ({ className }) => {
  const { mode, toggleColorMode } = useThemeContext();
  const theme = useTheme();

  return (
    <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
      <IconButton
        onClick={toggleColorMode}
        color="inherit"
        className={className}
        sx={{
          color: theme.palette.text.primary,
        }}
      >
        {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
      </IconButton>
    </Tooltip>
  );
}; 