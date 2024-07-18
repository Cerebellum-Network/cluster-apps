import { observer } from 'mobx-react-lite';
import { ReactNode } from 'react';

import { Box, Stack, styled, Typography } from '@developer-console/ui';

type StyleProps = {
  active?: boolean;
};

export type NavigationItemProps = StyleProps & {
  title: string;
  description: string;
  icon: ReactNode;
};

const Item = styled(Stack, {
  shouldForwardProp: (prop) => prop !== 'active',
})<StyleProps>(({ theme, active }) => ({
  cursor: 'pointer',
  outlineStyle: 'solid',
  padding: theme.spacing(2),
  borderTopLeftRadius: theme.shape.borderRadius,
  borderBottomLeftRadius: theme.shape.borderRadius,
  outlineWidth: active ? 2 : 1,
  outlineColor: active ? theme.palette.primary.main : theme.palette.divider,
  backgroundColor: active ? theme.palette.background.paper : 'transparent',
}));

const NavigationItem = ({ title, description, icon, active }: NavigationItemProps) => {
  return (
    <Item active={active} direction="row" spacing={2}>
      <Box fontSize={35} color={active ? 'primary.main' : 'text.secondary'}>
        {icon}
      </Box>
      <Stack flex={1}>
        <Typography variant="subtitle1">{title}</Typography>
        <Typography variant="body2">{description}</Typography>
      </Stack>
    </Item>
  );
};

export default observer(NavigationItem);
