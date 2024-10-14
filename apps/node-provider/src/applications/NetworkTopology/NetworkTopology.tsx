import { observer } from 'mobx-react-lite';
import { Stack, Typography } from '@cluster-apps/ui';

const NetworkTopology = () => {
  return (
    <Stack spacing={2}>
      <Typography variant="h4">NetworkTopology</Typography>
    </Stack>
  );
};

export default observer(NetworkTopology);
