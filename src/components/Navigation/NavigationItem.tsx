import { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, LinkProps, useMatch } from 'react-router-dom';

import { Button, ButtonProps, Stack, styled, Typography } from '@developer-console/ui';

type StyleProps = {
  active?: boolean;
};

export type NavigationItemProps = {
  title: string;
  rootPath: string;
  description: string;
  icon: ReactNode;
};

const NavButton = (props: ButtonProps & LinkProps) => <Button component={Link} {...props} />;
const Item = styled(NavButton, {
  shouldForwardProp: (prop) => prop !== 'active',
})<StyleProps>(({ theme, active }) => ({
  padding: theme.spacing(2),
  borderRadius: 0,
  outlineStyle: 'solid',
  outlineWidth: active ? 2 : 1,
  outlineColor: active ? theme.palette.primary.main : theme.palette.divider,
  backgroundColor: active ? theme.palette.background.paper : 'transparent',
  borderTopLeftRadius: theme.shape.borderRadius,
  borderBottomLeftRadius: theme.shape.borderRadius,

  '&:hover': {
    backgroundColor: active ? theme.palette.background.paper : theme.palette.action.hover,
  },

  '& .MuiSvgIcon-root': {
    fontSize: 35,
    color: active ? theme.palette.primary.main : theme.palette.text.secondary,
  },
}));

const NavigationItem = ({ rootPath, title, description, icon }: NavigationItemProps) => {
  const active = !!useMatch(rootPath);

  return (
    <Item disableRipple active={active} variant="text" color="inherit" to={rootPath}>
      <Stack direction="row" spacing={2}>
        {icon}

        <Stack flex={1}>
          <Typography variant="subtitle1">{title}</Typography>
          <Typography variant="body2">{description}</Typography>
        </Stack>
      </Stack>
    </Item>
  );
};

export default observer(NavigationItem);
