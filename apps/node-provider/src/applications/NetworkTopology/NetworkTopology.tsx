import { observer } from 'mobx-react-lite';
import {
  Box,
  Typography,
  Button,
  Table,
  TableCell,
  TableRow,
  Paper,
  TableBody,
  TableHead,
  TableContainer,
} from '@cluster-apps/ui';
import { useNavigate } from 'react-router-dom';
import { useAccount } from '~/hooks';
import { DDC_CLUSTER_ID } from '@cluster-apps/developer-console/src/constants.ts';

const NetworkTopology = () => {
  const account = useAccount();

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
      <Box padding="24px" borderRadius={(theme) => theme.spacing(0, 0, 1.5, 1.5)}>
        {account.ddcNodes?.length > 0 ? (
          <TableContainer component={Paper}>
            <Table sx={{ minWidth: 650 }} aria-label="simple table">
              <TableHead>
                <TableRow>
                  <TableCell align="left">Node ID</TableCell>
                  <TableCell align="left">Cluster ID</TableCell>
                  <TableCell align="left">Status</TableCell>
                  <TableCell align="right">Recourses consumed</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  {account.ddcNodes?.map(({ id }) => <TableCell>{id}</TableCell>)}
                  <TableCell>{DDC_CLUSTER_ID}</TableCell>
                  <TableCell>Approved</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
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
      </Box>
    </Box>
  );
};

export default observer(NetworkTopology);
