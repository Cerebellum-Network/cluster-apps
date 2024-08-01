import { observer } from 'mobx-react-lite';
import { Stack } from '@developer-console/ui';

import NavigationItem, { NavigationItemProps } from './NavigationItem';
import { ReactNode } from 'react';
import { Box } from '@mui/material';

export type NavigationProps = {
  items: NavigationItemProps[];
  buttonElement?: ReactNode;
};

const Navigation = ({ items, buttonElement }: NavigationProps) => (
  <Stack spacing={2}>
    {items.map((props) => (
      <NavigationItem key={props.rootPath} {...props} />
    ))}
    {buttonElement && (
      <Box display="flex" justifyContent="center">
        {buttonElement}
      </Box>
    )}
  </Stack>
);

export default observer(Navigation);
