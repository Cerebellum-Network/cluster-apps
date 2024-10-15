import { observer } from 'mobx-react-lite';
import { Stack, Box } from '@cluster-apps/ui';

import NavigationItem, { NavigationItemProps } from './NavigationItem';
import { ReactNode } from 'react';

export type NavigationProps = {
  items: NavigationItemProps[];
  footer?: ReactNode;
};

const Navigation = ({ items, footer }: NavigationProps) => (
  <Stack spacing={2}>
    {items.map(({ hideFromMenu = false, ...props }) =>
      !hideFromMenu ? <NavigationItem key={props.rootPath} {...props} /> : null,
    )}
    {footer && (
      <Box display="flex" justifyContent="center">
        {footer}
      </Box>
    )}
  </Stack>
);

export default observer(Navigation);
