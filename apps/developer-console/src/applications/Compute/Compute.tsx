import { observer } from 'mobx-react-lite';
import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  CardActions,
  Stack,
  Button,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
} from '@cluster-apps/ui';
import { COMPUTE_TIERS, ComputeTier, ADMIN_EMAILS } from '~/constants';
import { CloudFlashIcon, CheckIcon } from '@cluster-apps/ui';
import { useAccountStore } from '~/hooks';
import { ClusterManagementApi } from '@cluster-apps/api';
import ComputeStatusCheck from './ComputeStatusCheck';
import AdminPanel from './AdminPanel';

const ComputeTierCard = ({ tier, onSelectTier }: { tier: ComputeTier; onSelectTier: (tier: ComputeTier) => void }) => {
  const isPopular = tier.id === 'advanced';

  return (
    <Card
      sx={{
        height: '100%',
        position: 'relative',
        backgroundColor: 'background.paper',
        border: isPopular ? '2px solid' : '1px solid',
        borderColor: isPopular ? 'primary.main' : 'divider',
        borderRadius: 2,
        boxShadow: isPopular ? '0px 8px 12px 0px #1A0A7C1A' : 'none',
        '&:hover': {
          boxShadow: '0px 8px 12px 0px #1A0A7C1A',
          transform: 'translateY(-2px)',
          transition: 'all 0.2s ease-in-out',
        },
      }}
    >
      {isPopular && (
        <Paper
          sx={{
            position: 'absolute',
            top: -10,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1,
            px: 1.5,
            py: 0.5,
            backgroundColor: 'primary.main',
            color: 'white',
            borderRadius: 1,
            boxShadow: '0px 2px 4px rgba(88, 101, 242, 0.3)',
          }}
        >
          <Typography variant="caption" fontWeight="bold">
            Most Popular
          </Typography>
        </Paper>
      )}

      <CardHeader
        title={
          <Stack direction="row" alignItems="center" spacing={1}>
            <CloudFlashIcon sx={{ color: 'primary.main', fontSize: 24 }} />
            <Typography variant="subtitle1" component="div" sx={{ fontWeight: 600, color: 'text.primary' }}>
              {tier.name}
            </Typography>
          </Stack>
        }
        subheader={
          <Typography variant="body2" color="text.secondary">
            {tier.description}
          </Typography>
        }
        sx={{ pb: 1 }}
      />

      <CardContent sx={{ pt: 0 }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h4" color="primary.main" fontWeight="bold">
              {tier.price}
            </Typography>
          </Box>

          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <CheckIcon fontSize="small" sx={{ color: 'primary.main' }} />
              <Typography variant="body2" color="text.primary">
                {tier.cpu} CPU cores
              </Typography>
            </Stack>

            <Stack direction="row" alignItems="center" spacing={1.5}>
              <CheckIcon fontSize="small" sx={{ color: 'primary.main' }} />
              <Typography variant="body2" color="text.primary">
                {tier.ram} GB RAM
              </Typography>
            </Stack>

            <Stack direction="row" alignItems="center" spacing={1.5}>
              <CheckIcon fontSize="small" sx={{ color: 'primary.main' }} />
              <Typography variant="body2" color="text.primary">
                {tier.gpuCredits.toLocaleString()} GPU credits
              </Typography>
            </Stack>
          </Stack>
        </Stack>
      </CardContent>

      <CardActions sx={{ p: 2, pt: 0 }}>
        <Button
          variant={isPopular ? 'contained' : 'outlined'}
          fullWidth
          sx={{
            fontWeight: 600,
            textTransform: 'none',
            py: 1.5,
            ...(isPopular && {
              backgroundColor: 'primary.main',
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
            }),
            ...(!isPopular && {
              color: 'text.primary',
              borderColor: 'divider',
              '&:hover': {
                borderColor: 'primary.main',
                backgroundColor: 'primary.light',
              },
            }),
          }}
          onClick={() => onSelectTier(tier)}
        >
          Select {tier.name}
        </Button>
      </CardActions>
    </Card>
  );
};

const ConfirmationDialog = ({
  open,
  onClose,
  tier,
  onConfirm,
  isLoading,
  error,
}: {
  open: boolean;
  onClose: () => void;
  tier: ComputeTier | null;
  onConfirm: () => void;
  isLoading: boolean;
  error: string | null;
}) => {
  if (!tier) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <CloudFlashIcon sx={{ color: 'primary.main' }} />
          <Typography variant="subtitle1" component="div" sx={{ fontWeight: 600 }}>
            Confirm Compute Tier Selection
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h4" color="primary.main" fontWeight="bold" gutterBottom>
              {tier.name} Tier
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {tier.description}
            </Typography>
          </Box>

          <Box sx={{ p: 2, backgroundColor: 'background.default', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Resource Specifications:
            </Typography>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">CPU Cores:</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {tier.cpu}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">RAM:</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {tier.ram} GB
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">GPU Credits:</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {tier.gpuCredits.toLocaleString()}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">Price:</Typography>
                <Typography variant="body2" fontWeight="bold" color="primary.main">
                  {tier.price}
                </Typography>
              </Stack>
            </Stack>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          <Alert severity="info">
            <Typography variant="body2">
              <strong>Next Steps:</strong> After confirmation, you'll need to contact the Dragon1 operator to get
              whitelisted and receive access to the configured Agent Service in ROB with preconfigured data stream.
            </Typography>
          </Alert>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={16} /> : null}
        >
          {isLoading ? 'Submitting...' : 'Confirm Selection'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const Compute = () => {
  const account = useAccountStore();
  const [selectedTier, setSelectedTier] = useState<ComputeTier | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [hasSubmittedSelection, setHasSubmittedSelection] = useState(false);
  const [forceRefreshStatus, setForceRefreshStatus] = useState(0);

  useEffect(() => {
    const checkUserStatus = async () => {
      if (!account.address) {
        setIsCheckingStatus(false);
        return;
      }

      try {
        const userInfo = await account.wallet.getUserInfo();
        const email = userInfo?.email;

        if (email) {
          setUserEmail(email);
          setIsAdmin(ADMIN_EMAILS.includes(email));

          // Check if user has already submitted a selection
          if (!ADMIN_EMAILS.includes(email)) {
            try {
              const clusterApi = new ClusterManagementApi();
              const existingSelection = await clusterApi.getComputeTierSelectionStatus(email, account.address);
              if (existingSelection) {
                setHasSubmittedSelection(true);
              }
            } catch (err) {
              console.log('No existing selection found or error checking:', err);
            }
          }
        }
      } catch (err) {
        console.error('Error checking user status:', err);
      } finally {
        setIsCheckingStatus(false);
      }
    };

    checkUserStatus();
  }, [account.address, account.wallet]);

  const handleSelectTier = (tier: ComputeTier) => {
    setSelectedTier(tier);
    setError(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    if (!isLoading) {
      setDialogOpen(false);
      setSelectedTier(null);
      setError(null);
    }
  };

  const handleConfirmSelection = async () => {
    if (!selectedTier || !account.address || !userEmail) {
      setError('Missing required information');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const clusterApi = new ClusterManagementApi();

      await clusterApi.submitComputeTierSelection({
        email: userEmail,
        publicKey: account.address,
        tier: selectedTier.id,
      });

      setHasSubmittedSelection(true);

      setDialogOpen(false);
      setSelectedTier(null);

      setForceRefreshStatus((prev) => prev + 1);

      localStorage.removeItem('toursDone');

      console.log('Cleared all tour completion status and redirecting to content-storage');

      setTimeout(() => {
        window.location.href = '/content-storage?compute-tour=true';
      }, 1000);

      console.log('Tier selection submitted successfully');
    } catch (err) {
      console.error('Error submitting tier selection:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit tier selection');
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingStatus) {
    return (
      <Box
        sx={{
          p: 3,
          backgroundColor: 'background.default',
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">
            Checking user status...
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (isAdmin) {
    return (
      <Box
        sx={{
          p: 3,
          backgroundColor: 'background.default',
          minHeight: '100vh',
        }}
      >
        <AdminPanel />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 3,
        backgroundColor: 'background.default',
        minHeight: '100vh',
      }}
    >
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ color: 'text.primary', fontWeight: 700 }}>
          Compute Tiers
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: '600px' }}>
          Choose the right compute tier for your workload. Deploy agents and configure deployment rules with predefined
          resource allocations.
        </Typography>

        <Box
          sx={{
            p: 2.5,
            backgroundColor: '#F5F6FF',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'primary.main',
            boxShadow: '0px 2px 4px rgba(88, 101, 242, 0.1)',
            mb: 3,
          }}
        >
          <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500 }}>
            <strong>Note:</strong> Contact the Dragon1 operator to get whitelisted and receive access to the configured
            Agent Service in ROB with preconfigured data stream.
          </Typography>
        </Box>

        <ComputeStatusCheck
          userEmail={userEmail}
          showStatus={hasSubmittedSelection}
          forceRefresh={forceRefreshStatus}
        />
      </Box>

      <Grid container spacing={3}>
        {COMPUTE_TIERS.map((tier) => (
          <Grid item xs={12} md={4} key={tier.id}>
            <ComputeTierCard tier={tier} onSelectTier={handleSelectTier} />
          </Grid>
        ))}
      </Grid>

      <ConfirmationDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        tier={selectedTier}
        onConfirm={handleConfirmSelection}
        isLoading={isLoading}
        error={error}
      />
    </Box>
  );
};

export default observer(Compute);
