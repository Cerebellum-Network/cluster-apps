import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  Grid,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@cluster-apps/ui';
import { observer } from 'mobx-react-lite';
import { PreFormattedBox } from '../../../components/PreformattedBox/PreformattedBox.tsx';
import { useNodeConfigurationStore } from '~/hooks';
import { useNavigate } from 'react-router-dom';
import { DDC_PRESET } from '../../../constants.ts';

const ConfigureNode = observer(() => {
  const nodeConfigurationStore = useNodeConfigurationStore();
  const navigate = useNavigate();

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
      <Box padding="24px" borderRadius={(theme) => theme.spacing(0, 0, 1.5, 1.5)}>
        <Box>
          <Typography variant="h4">Step 1: Configure your node</Typography>
          <FormControl component="fieldset" sx={{ my: 2 }}>
            <Typography variant="subtitle1">Node Type</Typography>
            <RadioGroup
              value={nodeConfigurationStore.nodeType}
              onChange={(e) => nodeConfigurationStore.setNodeType(e.target.value)}
            >
              <FormControlLabel value="cdn" control={<Radio />} label="CDN" />
              <FormControlLabel value="storage" control={<Radio />} label="Storage" />
            </RadioGroup>
          </FormControl>

          <Grid container spacing={2} sx={{ my: 2 }}>
            <Grid item xs={6}>
              <TextField
                label="Enter Host Name"
                value={nodeConfigurationStore.hostName}
                onChange={(e) => nodeConfigurationStore.setHostName(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Enter Port"
                value={nodeConfigurationStore.port}
                onChange={(e) => nodeConfigurationStore.setPort(e.target.value)}
                fullWidth
              />
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                label="Enter gRPC Port"
                value={nodeConfigurationStore.grpcPort}
                onChange={(e) => nodeConfigurationStore.setGrpcPort(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Enter P2P Port"
                value={nodeConfigurationStore.p2pPort}
                onChange={(e) => nodeConfigurationStore.setP2pPort(e.target.value)}
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
                {`bash <(curl -s https://cdn.dragon.cere.network/961/baear4ifvgsrxc6y5rsmxlyyste4cyv35np6noedn4jb3bsyriqd2skre4i/bootstrap.sh) "./" "${DDC_PRESET.blockchain}" "${nodeConfigurationStore.nodeType === 'cdn' ? 'cache' : 'storage'}" "${nodeConfigurationStore.nodeType}" "${nodeConfigurationStore.port || '8081'}" "${nodeConfigurationStore.grpcPort || '9091'}" "${nodeConfigurationStore.p2pPort || '9071'}"`}
              </Typography>
            </PreFormattedBox>
            <Box marginTop="10px">
              <Button variant="outlined" onClick={nodeConfigurationStore.handleCopyCommand}>
                Copy command
              </Button>
            </Box>
          </Box>
          <TextField
            label="Node Account Address"
            value={nodeConfigurationStore.nodePublicKey}
            fullWidth
            sx={{ my: 2 }}
            onChange={(e) => nodeConfigurationStore.setNodePublicKey(e.target.value)}
          />
        </Box>
        <Box sx={{ mb: 2 }} textAlign="end">
          <Button
            variant="contained"
            onClick={() => {
              navigate('/validation-and-staking');
            }}
            sx={{ mt: 1, mr: 1 }}
          >
            Validate settings
          </Button>
        </Box>
      </Box>
    </Box>
  );
});

export default ConfigureNode;
