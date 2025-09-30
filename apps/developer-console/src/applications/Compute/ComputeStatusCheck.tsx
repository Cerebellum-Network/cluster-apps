import { observer } from 'mobx-react-lite';
import { useState, useEffect } from 'react';
import { Typography, Card, CardContent, Stack, Button, CircularProgress, Alert } from '@cluster-apps/ui';
import { CheckCircleIcon, ClockIcon, CloseIcon, ArrowForwardIcon } from '@cluster-apps/ui';
import { useAccountStore } from '~/hooks';
import { ClusterManagementApi } from '@cluster-apps/api';

type ComputeTierStatus = 'pending' | 'approved' | 'rejected';

interface ComputeTierSelection {
  id: string;
  email: string;
  publicKey: string;
  tier: string;
  status: ComputeTierStatus;
  createdAt: string;
  updatedAt: string;
}

const ComputeStatusCheck = ({
  userEmail,
  showStatus,
  forceRefresh,
}: {
  userEmail: string | null;
  showStatus: boolean;
  forceRefresh?: number;
}) => {
  const account = useAccountStore();
  const [selection, setSelection] = useState<ComputeTierSelection | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = async () => {
    if (!account.address || !userEmail) {
      setError('Wallet not connected or email not available');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const clusterApi = new ClusterManagementApi();
      const result = await clusterApi.getComputeTierSelectionStatus(userEmail, account.address);
      setSelection(result);
    } catch (err) {
      console.error('Error checking status:', err);
      setError(err instanceof Error ? err.message : 'Failed to check status');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, [account.address, userEmail]);

  useEffect(() => {
    if (forceRefresh && showStatus) {
      checkStatus();
    }
  }, [forceRefresh]);

  const getStatusIcon = (status: ComputeTierStatus) => {
    switch (status) {
      case 'approved':
        return <CheckCircleIcon sx={{ color: 'success.main' }} />;
      case 'rejected':
        return <CloseIcon sx={{ color: 'error.main' }} />;
      case 'pending':
      default:
        return <ClockIcon sx={{ color: 'warning.main' }} />;
    }
  };

  const getStatusColor = (status: ComputeTierStatus) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'rejected':
        return 'error';
      case 'pending':
      default:
        return 'warning';
    }
  };

  const getStatusText = (status: ComputeTierStatus) => {
    switch (status) {
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'pending':
      default:
        return 'Pending Approval';
    }
  };

  if (!account.address) {
    return (
      <Card>
        <CardContent>
          <Alert severity="info">Please connect your wallet to check compute tier status.</Alert>
        </CardContent>
      </Card>
    );
  }

  if (!showStatus) {
    return null;
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Compute Tier Status
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={isLoading ? <CircularProgress size={16} /> : <ArrowForwardIcon />}
              onClick={checkStatus}
              disabled={isLoading}
            >
              {isLoading ? 'Checking...' : 'Refresh'}
            </Button>
          </Stack>

          {error && <Alert severity="error">{error}</Alert>}

          {selection ? (
            <Stack spacing={2}>
              <Stack direction="row" alignItems="center" spacing={1}>
                {getStatusIcon(selection.status)}
                <Typography variant="subtitle1" fontWeight="bold">
                  {selection.tier.toUpperCase()} Tier
                </Typography>
                <Typography
                  variant="body2"
                  fontWeight="bold"
                  color="#fff"
                  sx={{
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    backgroundColor: `${getStatusColor(selection.status)}.light`,
                    display: 'inline-block',
                  }}
                >
                  {getStatusText(selection.status)}
                </Typography>
              </Stack>

              <Typography variant="body2" color="text.secondary">
                Submitted: {new Date(selection.createdAt).toLocaleDateString()}
              </Typography>

              {selection.status === 'pending' && (
                <Alert severity="info">
                  Your compute tier selection is pending approval. Please wait for the Dragon1 operator to review your
                  request.
                </Alert>
              )}

              {selection.status === 'approved' && (
                <Alert severity="success" variant="standard">
                  Congratulations! Your compute tier has been approved. You can now proceed with deployment.
                </Alert>
              )}

              {selection.status === 'rejected' && (
                <Alert severity="error">
                  Your compute tier selection was rejected. Please contact support for more information.
                </Alert>
              )}
            </Stack>
          ) : (
            !isLoading &&
            !error && (
              <Alert severity="info">No compute tier selection found. Please select a tier to get started.</Alert>
            )
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default observer(ComputeStatusCheck);
