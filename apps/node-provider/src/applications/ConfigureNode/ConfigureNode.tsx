import {
  Typography,
  Button,
  Box,
  styled,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  TextField,
  FormControl,
  RadioGroup,
  Radio,
  FormControlLabel,
  Checkbox,
  Grid,
} from '@cluster-apps/ui';
import { useState } from 'react';
import { useAccount } from '~/hooks';
import { PreFormattedBox } from '../../components/PreformattedBox/PreformattedBox.tsx';
import { useNodeRunCommand } from '../../hooks';
import { ClusterManagementApi } from '@cluster-apps/api';
import { NodeAccessParams } from '@cluster-apps/api/src/ClusterManagementApi/types.ts';

const Container = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.default,
}));

const ConfigureNode = () => {
  const account = useAccount();

  const [activeStep, setActiveStep] = useState(0);
  const [nodeType, setNodeType] = useState('cdn');
  const [domain, setDomain] = useState('');
  const [sslEnabled, setSslEnabled] = useState(false);
  const [hostName, setHostName] = useState('');
  const [port, setPort] = useState('');
  const [grpcPort, setGrpcPort] = useState('');
  const [p2pPort, setP2pPort] = useState('');
  const [status, setStatus] = useState("validation hasn't started yet");
  const [checks, setChecks] = useState({
    openPortChecked: false,
    nodeVersionChecked: false,
    nodeKeyChecked: false,
  });

  const handleValidation = async () => {
    setStatus('Validation in progress...');
    try {
      const clusterManagementApi = new ClusterManagementApi();
      const nodeParams: NodeAccessParams = {
        host: hostName,
        httpPort: port,
        grpcPort,
        p2pPort,
      };
      if (domain.length > 0) {
        nodeParams.domain = domain;
      }
      const response = await clusterManagementApi.validateNodeConfiguration(nodeParams);

      if (response.data.unreachable.length === 0) {
        setChecks({
          openPortChecked: true,
          nodeVersionChecked: true,
          nodeKeyChecked: true,
        });

        setStatus('Validation successful!');
      }
    } catch (error) {
      setStatus('Validation failed!');
    }
    setActiveStep((prevState) => prevState + 1);
  };

  const { runCommand, runCommandPrefix, secretPhraseEnvVariable, dockerImage } = useNodeRunCommand({
    nodePublicKey: account.address as string,
    port: +port,
    nodeType: nodeType as 'storage' | 'cdn',
    mnemonic: '',
    grpcPort: +grpcPort,
    p2pPort: +p2pPort,
  });

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(runCommand);
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
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
        <Typography variant="h3">Node Configuration</Typography>
      </Box>
      <Container padding="24px" borderRadius={(theme) => theme.spacing(0, 0, 1.5, 1.5)}>
        <Stepper activeStep={activeStep} orientation="vertical">
          <Step key={1}>
            <StepLabel>Configure Node</StepLabel>
            <StepContent>
              <Box sx={{ maxWidth: 600, mx: 'auto' }}>
                <Typography variant="h6">Step 1: Node Configuration</Typography>

                <TextField
                  label="Node Account Address"
                  value={account.address}
                  disabled
                  fullWidth
                  InputProps={{
                    readOnly: true,
                  }}
                  sx={{ my: 2 }}
                />

                <FormControl component="fieldset" sx={{ my: 2 }}>
                  <Typography variant="subtitle1">Node Type</Typography>
                  <RadioGroup value={nodeType} onChange={(e) => setNodeType(e.target.value)}>
                    <FormControlLabel value="cdn" control={<Radio />} label="CDN" />
                    <FormControlLabel value="storage" control={<Radio />} label="Storage" />
                  </RadioGroup>
                </FormControl>

                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={8}>
                    <TextField
                      label="Enter Domain (optional)"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <FormControlLabel
                      control={<Checkbox checked={sslEnabled} onChange={(e) => setSslEnabled(e.target.checked)} />}
                      label="SSL"
                    />
                  </Grid>
                </Grid>

                <Grid container spacing={2} sx={{ my: 2 }}>
                  <Grid item xs={6}>
                    <TextField
                      label="Enter Host Name"
                      value={hostName}
                      onChange={(e) => setHostName(e.target.value)}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField label="Enter Port" value={port} onChange={(e) => setPort(e.target.value)} fullWidth />
                  </Grid>
                </Grid>

                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      label="Enter gRPC Port"
                      value={grpcPort}
                      onChange={(e) => setGrpcPort(e.target.value)}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Enter P2P Port"
                      value={p2pPort}
                      onChange={(e) => setP2pPort(e.target.value)}
                      fullWidth
                    />
                  </Grid>
                </Grid>

                <Box marginTop="20px">
                  <Typography variant="body1">Open your CLI on the node and enter this command:</Typography>
                  <PreFormattedBox sx={{ my: 3, p: 2, backgroundColor: '#f5f5f5', borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-line', my: 1 }}>
                      {/*docker run -d --name ddc-storage-node -p {port}:{port} -v /home/user/ddc/data:/data:rw -v*/}
                      {/*/home/user/ddc/config:/ddc-storage-node/config:rw*/}
                      {/*cerebellumnetwork/ddc-storage-node:dev-latestf587f74880f9b6f17ce68734d6c393e63f7ffd38289b55b0ee828f81434270{' '}*/}
                      {/*<span style={{ color: 'red' }}>{'your secret phrase here'}</span>*/}
                      {runCommandPrefix} {secretPhraseEnvVariable}="
                      <span style={{ color: 'red' }}>{'your secret phrase here'}</span>" {dockerImage}
                    </Typography>
                  </PreFormattedBox>
                  <Typography variant="body2">* Your seed phrase should replace the red text</Typography>
                  <Button variant="outlined" onClick={handleCopyCommand}>
                    Copy command
                  </Button>
                </Box>
              </Box>
              <Box sx={{ mb: 2 }} textAlign="end">
                <Button variant="contained" onClick={handleNext} sx={{ mt: 1, mr: 1 }}>
                  Validate settings
                </Button>
              </Box>
            </StepContent>
          </Step>
          <Step key={2}>
            <StepLabel>Step 2 - Node configuration validation</StepLabel>
            <StepContent>
              <Typography variant="h6">Current status: {status}</Typography>

              <Box display="flex" flexDirection="column">
                <FormControlLabel control={<Checkbox checked={checks.openPortChecked} />} label="Open port checked" />
                <FormControlLabel
                  control={<Checkbox checked={checks.nodeVersionChecked} />}
                  label="Node version checked"
                />
                <FormControlLabel control={<Checkbox checked={checks.nodeKeyChecked} />} label="Node key checked" />
              </Box>

              <Button variant="contained" color="primary" onClick={handleValidation} sx={{ marginTop: 2 }}>
                Validate Node Configuration
              </Button>
            </StepContent>
          </Step>
          <Step key={3}>
            <StepLabel>Step 3 - Stake and join the cluster</StepLabel>
            <StepContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Typography variant="h4">Join cluster with security deposit</Typography>
                <Button>Join cluster</Button>
              </Box>
            </StepContent>
          </Step>
        </Stepper>
      </Container>
    </Box>
  );
};

export default ConfigureNode;
