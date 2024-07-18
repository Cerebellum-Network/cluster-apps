import { observer } from 'mobx-react-lite';

import { Stack } from '@developer-console/ui';

export type SidebarProps = {};

const Sidebar = () => (
  <Stack justifyContent="center" alignItems="center" paddingTop={4}>
    Coming soon...
  </Stack>
);

export default observer(Sidebar);
