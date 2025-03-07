import { Stack, Typography } from '@cluster-apps/ui';
import { observer } from 'mobx-react-lite';
import { DataActivity } from '~/components/DataActivity';

const ActivityCapture = () => (
  <Stack spacing={2}>
    <Typography variant="h4">Customer Data</Typography>
    <DataActivity />
  </Stack>
);

export default observer(ActivityCapture);
