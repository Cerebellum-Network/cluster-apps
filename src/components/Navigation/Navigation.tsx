import { observer } from 'mobx-react-lite';
import { Stack, Box } from '@developer-console/ui';

import NavigationItem, { NavigationItemProps } from './NavigationItem';
import { ReactNode } from 'react';

export type NavigationProps = {
  items: NavigationItemProps[];
  footer?: ReactNode;
};

const Navigation = ({ items, footer }: NavigationProps) => (
  <Stack spacing={2}>
    {items.map((props) => (
      <NavigationItem key={props.rootPath} {...props} />
    ))}
    {footer && (
      <Box display="flex" justifyContent="center">
        {footer}
      </Box>
    )}
  </Stack>
);

export default observer(Navigation);
