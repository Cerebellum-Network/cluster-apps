import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';

import { Typography, Layout, Paper, Button, ArrowForwardIcon, Stack, Box, DiscordIcon } from '@developer-console/ui';

const Onboarding = () => {
  const navigate = useNavigate();

  return (
    <Layout
      headerRight={
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" color="secondary">
            Developer Docs
          </Button>

          <Button startIcon={<DiscordIcon />}>Discord</Button>
        </Stack>
      }
    >
      <Stack spacing={4} direction="row">
        <Paper component={Box} variant="outlined" flex={1} padding={4}>
          <Typography>Onboarding content...</Typography>
          <Button
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            onClick={() => {
              navigate('/');
            }}
          >
            Get started
          </Button>
        </Paper>
        <Box flex={1}>
          <Typography>Slider</Typography>
        </Box>
      </Stack>
    </Layout>
  );
};

export default observer(Onboarding);
