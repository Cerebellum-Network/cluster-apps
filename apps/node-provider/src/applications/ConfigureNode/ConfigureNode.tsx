import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  Grid,
  Radio,
  RadioGroup,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  styled,
  TextField,
  Typography,
  CircularProgress,
} from '@cluster-apps/ui';
import { useCallback, useState } from 'react';
import { PreFormattedBox } from '../../components/PreformattedBox/PreformattedBox.tsx';
import { ClusterManagementApi, NodeAccessParams } from '@cluster-apps/api';
import { DdcBlockchainStore } from '../../stores';
import { observer } from 'mobx-react-lite';
import { StorageNodeMode, StorageNodeProps } from '@cere-ddc-sdk/blockchain';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const Container = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.default,
}));

const ConfigureNode = observer(() => {
  const ddcBlockchainStore = new DdcBlockchainStore();
  const [nodePublicKey, setNodePublicKey] = useState<string>('');
  const [activeStep, setActiveStep] = useState(0);
  const [nodeType, setNodeType] = useState('cdn');
  const [hostName, setHostName] = useState('127.0.0.1');
  const [port, setPort] = useState('8081');
  const [grpcPort, setGrpcPort] = useState('9091');
  const [p2pPort, setP2pPort] = useState('9071');
  const [status, setStatus] = useState("validation hasn't started yet");
  const [checks, setChecks] = useState({
    openPortChecked: false,
    nodeVersionChecked: false,
    nodeKeyChecked: false,
  });
  const [isLoading, setLoading] = useState(false);

  const handleValidation = async () => {
    setStatus('Validation in progress...');
    try {
      const clusterManagementApi = new ClusterManagementApi();
      const nodeParams: NodeAccessParams = {
        host: hostName,
        httpPort: port,
        grpcPort,
        p2pPort,
        domain: 'www.example.com',
      };

      const response = await clusterManagementApi.validateNodeConfiguration(nodeParams);

      if (response.data.unreachable.length === 0) {
        await activateCheckboxesWithDelay();

        setStatus('Validation successful!');
      }
    } catch (error) {
      setStatus('Validation failed!');
    }
    setActiveStep((prevState) => prevState + 1);
  };

  const activateCheckboxesWithDelay = async () => {
    setChecks((prevChecks) => ({ ...prevChecks, openPortChecked: true }));
    await delay(2000);

    setChecks((prevChecks) => ({ ...prevChecks, nodeVersionChecked: true }));
    await delay(2000);

    setChecks((prevChecks) => ({ ...prevChecks, nodeKeyChecked: true }));
  };

  const handleCopyCommand = () => {
    const storageRoot = '/Users/antonmazhuto/Documents/Work/storage_node';
    // const storageRoot = '/home/user/ddc/data';
    const mode = nodeType === 'cdn' ? 'cache' : 'storage';
    const command = `./bootstrap.sh "/Users/antonmazhuto/Documents/Work/storage_node" "wss://rpc.testnet.cere.network/ws" "storage" "storage" "8081" "9091" "9071"`;
    // const command = `./bootstrap.sh "${storageRoot}" "${DDC_PRESET.blockchain}" "${mode}" "${nodeType}" "${port}" "${grpcPort}" "${p2pPort}" --node-type="${nodeType}" --domain="${hostName}"`;
    // const command = `curl -s https://getmyscript.io --node-type="${nodeType}" --domain="${hostName}" | sh -s -- "${storageRoot}" "${DDC_PRESET.blockchain}" "${mode}" "${nodeType}" "${port}" "${grpcPort}" "${p2pPort}"`;

    navigator.clipboard.writeText(command).then(() => {
      console.log('Команда скопирована в буфер обмена');
    });
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const addNodeToTheCluster = useCallback(async () => {
    const nodeParams: StorageNodeProps = {
      host: hostName,
      httpPort: +port,
      grpcPort: +grpcPort,
      p2pPort: +p2pPort,
      mode: nodeType === 'cdn' ? StorageNodeMode.Cache : StorageNodeMode.Storage,
    };
    setLoading(true);
    try {
      await ddcBlockchainStore.addStorageNodeToCluster({ nodePublicKey, nodeParams });
      console.log('Your node was added to the cluster successfully!');
    } catch (error) {
      console.error('Error adding node to cluster:', error);
    } finally {
      setLoading(false);
    }
  }, [ddcBlockchainStore, grpcPort, hostName, nodePublicKey, nodeType, p2pPort, port]);

  console.log(ddcBlockchainStore.status);

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
                <Typography variant="h4">Step 1: Configure your node</Typography>
                <FormControl component="fieldset" sx={{ my: 2 }}>
                  <Typography variant="subtitle1">Node Type</Typography>
                  <RadioGroup value={nodeType} onChange={(e) => setNodeType(e.target.value)}>
                    <FormControlLabel value="cdn" control={<Radio />} label="CDN" />
                    <FormControlLabel value="storage" control={<Radio />} label="Storage" />
                  </RadioGroup>
                </FormControl>

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

                <Box marginTop="20px" marginBottom="20px">
                  <Typography variant="body1">
                    Open your CLI and use this command to create a public node key and run the node:
                  </Typography>
                  <PreFormattedBox>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-line', my: 1 }}>
                      curl https://www.cere.network/bootstrap.sh | sh
                    </Typography>
                  </PreFormattedBox>
                  <Box marginTop="10px">
                    <Button variant="outlined" onClick={handleCopyCommand}>
                      Copy command
                    </Button>
                  </Box>
                </Box>
                <TextField
                  label="Node Account Address"
                  value={nodePublicKey}
                  fullWidth
                  sx={{ my: 2 }}
                  onChange={(e) => setNodePublicKey(e.target.value)}
                />
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
              <Typography variant="h4">Current status: {status}</Typography>

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
                <Box display="flex" justifyContent="space-between">
                  <Button onClick={addNodeToTheCluster} disabled={isLoading}>
                    {isLoading ? (
                      <Box display="flex" alignItems="center">
                        <CircularProgress size={20} color="inherit" sx={{ marginRight: '8px' }} />
                        Joining...
                      </Box>
                    ) : (
                      'Join cluster'
                    )}
                  </Button>
                </Box>
              </Box>
            </StepContent>
          </Step>
        </Stepper>
      </Container>
    </Box>
  );
});

export default ConfigureNode;
