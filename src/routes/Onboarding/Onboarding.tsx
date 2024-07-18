import { observer } from 'mobx-react-lite';
import { Typography, Layout, Paper, Button, ArrowForwardIcon, Stack, Box } from '@developer-console/ui';

const Onboarding = () => (
  <Layout headerRight={<Typography>Buttons</Typography>}>
    <Stack spacing={4} direction="row">
      <Paper component={Box} variant="outlined" flex={1} padding={4}>
        <Typography>Onboarding content...</Typography>
        <Button variant="contained" endIcon={<ArrowForwardIcon />}>
          Get started
        </Button>
      </Paper>
      <Box flex={1}>
        <Typography>Slider</Typography>
      </Box>
    </Stack>
  </Layout>
);

export default observer(Onboarding);
