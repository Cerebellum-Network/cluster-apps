import { Box, Button, Checkbox, FormControlLabel, Typography, CircularProgress, Grid, Alert } from '@cluster-apps/ui';
import { observer } from 'mobx-react-lite';
import { useNodeConfigurationStore, useDdcBlockchainStore, useAccount } from '~/hooks';
import { Link, useNavigate } from 'react-router-dom';

const ValidationAndStaking = observer(() => {
  const nodeConfigurationStore = useNodeConfigurationStore();
  const ddcBlockchainStore = useDdcBlockchainStore();
  const account = useAccount();

  const navigate = useNavigate();

  const areAllChecksComplete = Object.values(nodeConfigurationStore.checks).every((checked) => checked === true);

  return (
    <Box>
      <Button
        variant="outlined"
        color="primary"
        onClick={() => {
          navigate(-1);
        }}
        sx={{ marginBottom: 2 }}
      >
        Back
      </Button>
      <Box
        display="flex"
        flexDirection="column"
        border={(theme) => `1px solid ${theme.palette.divider}`}
        borderRadius="12px"
        marginBottom="20px"
      >
        <Box padding="34px 32px" borderBottom={(theme) => `1px solid ${theme.palette.divider}`}>
          <Typography variant="h3">Step 2 - Node configuration validation</Typography>
        </Box>
        <Box padding="24px" borderRadius={(theme) => theme.spacing(0, 0, 1.5, 1.5)}>
          <Typography variant="h4">Current status: {nodeConfigurationStore.status}</Typography>
          <Box display="flex" flexDirection="column">
            <FormControlLabel
              control={<Checkbox checked={nodeConfigurationStore.checks.openPortChecked} />}
              label="Open port checked"
            />
            <FormControlLabel
              control={<Checkbox checked={nodeConfigurationStore.checks.nodeVersionChecked} />}
              label="Node version checked"
            />
            <FormControlLabel
              control={<Checkbox checked={nodeConfigurationStore.checks.nodeKeyChecked} />}
              label="Node key checked"
            />
          </Box>

          <Button
            variant="contained"
            color="primary"
            disabled={areAllChecksComplete}
            onClick={nodeConfigurationStore.handleValidation}
            sx={{ marginTop: 2 }}
          >
            {areAllChecksComplete ? 'Successfully Validated' : 'Validate Node Configuration'}
          </Button>
        </Box>
      </Box>
      <Box
        display="flex"
        flexDirection="column"
        border={(theme) => `1px solid ${theme.palette.divider}`}
        borderRadius="12px"
        marginBottom="20px"
      >
        <Box padding="34px 32px" borderBottom={(theme) => `1px solid ${theme.palette.divider}`}>
          <Typography variant="h3">Step 3 - Stake and join the cluster</Typography>
        </Box>
        <Box padding="24px" borderRadius={(theme) => theme.spacing(0, 0, 1.5, 1.5)}>
          {account.balance === 0 && (
            <Alert sx={{ marginBottom: '20px' }} severity="warning">
              Your DDC Wallet balance is 0. Please top it up.
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="h4">Join cluster with security deposit</Typography>
              <Typography variant="caption">Top up your Cere wallet for N $Cere to stake security deposit</Typography>
              <Link style={{ marginLeft: '5px' }} to="#">
                How to top up?
              </Link>
            </Grid>
            <Grid item xs={6} textAlign="right">
              <Button
                onClick={() => nodeConfigurationStore.addNodeToTheCluster()}
                disabled={nodeConfigurationStore.isLoading}
              >
                {nodeConfigurationStore.isLoading ? (
                  <Box display="flex" alignItems="center">
                    <CircularProgress size={20} color="inherit" sx={{ marginRight: '8px' }} />
                    Joining...
                  </Box>
                ) : (
                  'Join cluster'
                )}
              </Button>
              {ddcBlockchainStore.status && (
                <Typography marginBottom="20px">
                  <b>Status</b>: {ddcBlockchainStore.status}
                </Typography>
              )}
            </Grid>
          </Grid>
        </Box>
      </Box>
    </Box>
  );
});

export default ValidationAndStaking;
