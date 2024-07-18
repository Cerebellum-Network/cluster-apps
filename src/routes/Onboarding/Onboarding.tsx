import { observer } from 'mobx-react-lite';
import { Typography, Layout, Paper } from '@developer-console/ui';

const Onboarding = () => {
  return (
    <Layout headerRight={<Typography>Buttons</Typography>}>
      <Paper variant="outlined">
        <Typography>Onboarding content...</Typography>
      </Paper>
    </Layout>
  );
};

export default observer(Onboarding);
