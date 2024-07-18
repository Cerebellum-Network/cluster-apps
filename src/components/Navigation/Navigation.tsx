import { observer } from 'mobx-react-lite';
import { Stack } from '@developer-console/ui';

import NavigationItem, { NavigationItemProps } from './NavigationItem';

export type NavigationProps = {
  items: NavigationItemProps[];
};

const Navigation = ({ items }: NavigationProps) => (
  <Stack spacing={2}>
    {items.map((props) => (
      <NavigationItem {...props} />
    ))}
  </Stack>
);

export default observer(Navigation);
