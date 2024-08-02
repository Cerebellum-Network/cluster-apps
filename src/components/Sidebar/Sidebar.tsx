import { observer } from 'mobx-react-lite';

import { BytesSize, ChartWidget, Stack, Typography } from '@developer-console/ui';
import { useAccountStore } from '~/hooks';

export type SidebarProps = {};

const Sidebar = () => {
  const { metrics } = useAccountStore();
  const titleCere = 0; // TODO: get real data

  return (
    <Stack padding={2} spacing={3}>
      <Typography variant="subtitle2">Account Usage</Typography>
      <ChartWidget
        title="Total Storage"
        value={<BytesSize bytes={metrics?.total.storedBytes || 0} />}
        history={metrics?.history.map((item) => ({
          value: item.storedBytes,
          date: item.recordTime,
        }))}
      />

      <ChartWidget title="Total CERE Consumption" value={`${titleCere} CERE`} />

      <ChartWidget
        title="Network Traffic"
        value={<BytesSize bytes={metrics?.total.transferredBytes || 0} />}
        history={metrics?.history.map((item) => ({
          value: item.transferredBytes,
          date: item.recordTime,
        }))}
      />
    </Stack>
  );
};

export default observer(Sidebar);
