import { BytesSize, ChartWidget, Stack, Typography } from '@cluster-apps/ui';

export type SidebarProps = {};

/**
 * Account-usage widget. Usage figures come from the DAC stats API, for which
 * there is no confirmed Dragon-1 host yet, so the values are shown as empty
 * (0) until a data source is wired in a later phase.
 */
const Sidebar = () => {
  return (
    <Stack padding={2} spacing={3}>
      <Typography variant="subtitle2">Account Usage</Typography>
      <ChartWidget title="Total Storage" value={<BytesSize bytes={0} />} />
      <ChartWidget title="Total CERE Consumption" value="0 CERE" formatValue={(value) => `${value}`} />
      <ChartWidget title="Network Traffic" value={<BytesSize bytes={0} />} />
    </Stack>
  );
};

export default Sidebar;
