import React from 'react';
import { IconContainer, NavigationCard } from './NavigationItem.styled';
import { Link } from 'react-router-dom';
import { Typography } from '@developer-console/ui';

interface NavigationItemProps extends React.PropsWithChildren {
  icon: React.ReactNode;
  href: string;
}

const NavigationItem = ({ children, icon, href }: NavigationItemProps) => {
  return (
    <Link to={href} style={{ width: '100%' }}>
      <NavigationCard>
        <Typography variant="h5" color="black">
          {children}
        </Typography>
        <IconContainer>{icon}</IconContainer>
      </NavigationCard>
    </Link>
  );
};

export default NavigationItem;
