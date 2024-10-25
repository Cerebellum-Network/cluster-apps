import { observer } from 'mobx-react-lite';
import { Box, Typography, Button, styled } from '@cluster-apps/ui';
import { useNavigate } from 'react-router-dom';
import { useAccount } from '~/hooks';

const Container = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.default,
}));

const NetworkTopology = () => {
  const account = useAccount();

  console.log(account.ddcNodes);

  const navigate = useNavigate();

  const handleConfigureNode = () => {
    navigate('/configure-node');
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      border={(theme) => `1px solid ${theme.palette.divider}`}
      borderRadius="12px"
      marginBottom="20px"
    >
      <Box padding="34px 32px" borderBottom={(theme) => `1px solid ${theme.palette.divider}`}>
        <Typography variant="h3">Network Topology</Typography>
      </Box>
      <Container padding="24px" borderRadius={(theme) => theme.spacing(0, 0, 1.5, 1.5)}>
        {account.ddcNodes?.length > 0 ? (
          'Soon'
        ) : (
          <Box textAlign="center">
            <Typography variant="h4" marginBottom="20px">
              Your nodes will be shown here after the setup
            </Typography>
            <Button variant="contained" onClick={handleConfigureNode}>
              Configure your first node
            </Button>
          </Box>
        )}
      </Container>
    </Box>
  );
};

export default observer(NetworkTopology);
