import { useState, useCallback, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { 
  Stack, 
  Box, 
  styled, 
  IconButton, 
  Tooltip
} from '@cluster-apps/ui';
import { useTheme } from '@mui/material';
import { 
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon
} from '@mui/icons-material';

import Navigation, { NavigationProps } from './Navigation';

interface CollapsibleNavigationProps extends NavigationProps {
  defaultCollapsed?: boolean;
}

const COLLAPSED_WIDTH = 64;
const EXPANDED_WIDTH = 240;
const TRANSITION_DURATION = 0.3;

const NavigationContainer = styled(Box)<{ collapsed: boolean }>(({ theme, collapsed }) => ({
  position: 'relative',
  width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
  transition: `width ${TRANSITION_DURATION}s ease`,
  overflow: 'hidden',
  flexShrink: 0,
}));

const ToggleButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  right: -12,
  top: 12,
  zIndex: 10,
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: theme.shadows[2],
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

const CollapsedNavigation = styled(Box)(({ theme }) => ({
  width: COLLAPSED_WIDTH,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: theme.spacing(2, 0),
}));

// Ensure consistent icon sizing and positioning
const IconWrapper = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  width: 40,
  height: 40,
  borderRadius: '50%',
  '& .MuiSvgIcon-root': {
    fontSize: 24,
  },
}));

const NavItemContainer = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(1),
  width: '100%',
  display: 'flex',
  justifyContent: 'center',
}));

const CollapsibleNavigation = ({ 
  items, 
  footer,
  defaultCollapsed = false
}: CollapsibleNavigationProps) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [hovered, setHovered] = useState(false);
  const theme = useTheme();

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => !prev);
    // Save preference to localStorage
    localStorage.setItem('sidebarCollapsed', String(!collapsed));
  }, [collapsed]);

  // Load preference from localStorage on mount
  useEffect(() => {
    const savedCollapsed = localStorage.getItem('sidebarCollapsed');
    if (savedCollapsed !== null) {
      setCollapsed(savedCollapsed === 'true');
    }
  }, []);

  // Handle hover events
  const handleMouseEnter = useCallback(() => {
    if (collapsed) {
      setHovered(true);
    }
  }, [collapsed]);

  const handleMouseLeave = useCallback(() => {
    if (collapsed) {
      setHovered(false);
    }
  }, [collapsed]);

  return (
    <NavigationContainer 
      collapsed={collapsed && !hovered}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <ToggleButton 
        size="small" 
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
      </ToggleButton>

      {collapsed && !hovered ? (
        <CollapsedNavigation>
          {items.map((item) => (
            <NavItemContainer key={item.rootPath}>
              <Tooltip 
                title={item.title} 
                placement="right"
                arrow
              >
                <Box 
                  component="a" 
                  href={`/${item.rootPath}`} 
                  sx={{ 
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    color: theme.palette.text.primary,
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    }
                  }}
                >
                  <IconWrapper>{item.icon}</IconWrapper>
                </Box>
              </Tooltip>
            </NavItemContainer>
          ))}
        </CollapsedNavigation>
      ) : (
        <Navigation items={items} footer={footer} />
      )}
    </NavigationContainer>
  );
};

export default observer(CollapsibleNavigation); 