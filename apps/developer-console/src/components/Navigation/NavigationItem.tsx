import { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, LinkProps, useMatch } from 'react-router-dom';

import { Button, ButtonProps, Stack, styled, Typography, Box } from '@cluster-apps/ui';

type StyleProps = {
  active?: boolean;
};

export type NavigationItemProps = {
  title: string;
  rootPath: string;
  description: string;
  icon: ReactNode;
  widget?: ReactNode;
};

const NavButton = (props: ButtonProps & LinkProps) => <Button component={Link} {...props} />;
const Item = styled(NavButton, {
  shouldForwardProp: (prop) => prop !== 'active',
})<StyleProps>(({ theme, active }) => ({
  padding: theme.spacing(0.5, 2),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: active ? theme.palette.action.selected : 'transparent',
  transition: 'all 0.2s ease-in-out',
  marginBottom: theme.spacing(1),
  justifyContent: 'flex-start',
  height: 'auto',
  minHeight: 56,
  
  '&:hover': {
    backgroundColor: active ? theme.palette.action.selected : theme.palette.action.hover,
    transform: 'translateX(4px)',
  },
}));

// Ensure consistent icon sizing and positioning
const IconWrapper = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  width: 40,
  height: 40,
  borderRadius: '50%',
  flexShrink: 0,
  '& .MuiSvgIcon-root': {
    fontSize: 24,
    color: theme.palette.text.secondary,
  },
}));

const NavigationItem = ({ rootPath, title, description, icon, widget }: NavigationItemProps) => {
  const active = !!useMatch(rootPath);
  const isGrantsRoute = rootPath === 'grants';
  
  // Gold gradient style for the Grants & Bounties text
  const textStyle = isGrantsRoute ? {
    background: 'linear-gradient(45deg, #FFD700 30%, #FFA500 90%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    textFillColor: 'transparent',
    fontWeight: 'bold'
  } : {};

  // Determine icon color based on active state and whether it's the grants route
  const iconColor = isGrantsRoute 
    ? 'transparent' // For grants route, the icon has its own gradient
    : active 
      ? 'primary.main' 
      : 'text.secondary';

  return (
    <Item disableRipple active={active} variant="text" color="inherit" to={rootPath}>
      <Stack direction="row" spacing={2} alignItems="center" width="100%">
        <IconWrapper sx={{ 
          '& .MuiSvgIcon-root': { 
            color: iconColor
          } 
        }}>
          {icon}
        </IconWrapper>
        <Typography variant="subtitle1" sx={textStyle}>{title}</Typography>
      </Stack>
      {widget}
    </Item>
  );
};

export default observer(NavigationItem);
