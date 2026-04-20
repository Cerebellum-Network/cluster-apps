import { observer } from 'mobx-react-lite';
import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Button,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@cluster-apps/ui';
import { CloseIcon, ArrowForwardIcon, CheckIcon, DeleteIcon } from '@cluster-apps/ui';
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

const AdminPanel = () => {
  const [selections, setSelections] = useState<ComputeTierSelection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectionToDelete, setSelectionToDelete] = useState<ComputeTierSelection | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadSelections = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const clusterApi = new ClusterManagementApi();
      const result = await clusterApi.getComputeTierSelections('');
      setSelections(result);
    } catch (err) {
      console.error('Error loading selections:', err);
      setError(err instanceof Error ? err.message : 'Failed to load selections');
    } finally {
      setIsLoading(false);
    }
  };

  const updateSelectionStatus = async (id: string, status: ComputeTierStatus) => {
    setUpdatingId(id);
    setError(null);

    try {
      const clusterApi = new ClusterManagementApi();
      await clusterApi.updateComputeTierSelection(id, { status });

      setSelections((prev) =>
        prev.map((selection) =>
          selection.id === id ? { ...selection, status, updatedAt: new Date().toISOString() } : selection,
        ),
      );
    } catch (err) {
      console.error('Error updating selection:', err);
      setError(err instanceof Error ? err.message : 'Failed to update selection');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteClick = (selection: ComputeTierSelection) => {
    setSelectionToDelete(selection);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectionToDelete) return;

    setIsDeleting(true);
    setError(null);

    try {
      const clusterApi = new ClusterManagementApi();
      await clusterApi.deleteComputeTierSelection(selectionToDelete.id);

      setSelections((prev) => prev.filter((s) => s.id !== selectionToDelete.id));

      setDeleteDialogOpen(false);
      setSelectionToDelete(null);
    } catch (err) {
      console.error('Error deleting selection:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete selection');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setSelectionToDelete(null);
  };

  useEffect(() => {
    loadSelections();
  }, []);

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
        return 'Pending';
    }
  };

  const pendingSelections = selections.filter((s) => s.status === 'pending');
  const approvedSelections = selections.filter((s) => s.status === 'approved');
  const rejectedSelections = selections.filter((s) => s.status === 'rejected');

  return (
    <Box>
      <Stack spacing={3}>
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h4" fontWeight="bold">
              Compute Tier Admin Panel
            </Typography>
            <Button
              variant="outlined"
              startIcon={isLoading ? <CircularProgress size={16} /> : <ArrowForwardIcon />}
              onClick={loadSelections}
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Refresh'}
            </Button>
          </Stack>

          <Typography variant="body2" color="text.secondary">
            Manage compute tier selection requests from developers
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        <Stack direction="row" spacing={2}>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="h4" color="warning.main" fontWeight="bold">
                {pendingSelections.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Pending Requests
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="h4" color="success.main" fontWeight="bold">
                {approvedSelections.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Approved
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="h4" color="error.main" fontWeight="bold">
                {rejectedSelections.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Rejected
              </Typography>
            </CardContent>
          </Card>
        </Stack>

        {pendingSelections.length > 0 && (
          <Card>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                Pending Requests ({pendingSelections.length})
              </Typography>

              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Developer</TableCell>
                      <TableCell>Tier</TableCell>
                      <TableCell>Public Key</TableCell>
                      <TableCell>Submitted</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pendingSelections.map((selection) => (
                      <TableRow key={selection.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {selection.email}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold" color="primary.main">
                            {selection.tier.toUpperCase()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">
                            {selection.publicKey.slice(0, 10)}...{selection.publicKey.slice(-6)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{new Date(selection.createdAt).toLocaleDateString()}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={1} justifyContent="center">
                            <Tooltip title="Approve">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => updateSelectionStatus(selection.id, 'approved')}
                                disabled={updatingId === selection.id}
                              >
                                {updatingId === selection.id ? <CircularProgress size={16} /> : <CheckIcon />}
                              </IconButton>
                            </Tooltip>

                            <Tooltip title="Reject">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => updateSelectionStatus(selection.id, 'rejected')}
                                disabled={updatingId === selection.id}
                              >
                                <CloseIcon />
                              </IconButton>
                            </Tooltip>

                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteClick(selection)}
                                disabled={updatingId === selection.id}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
              All Requests ({selections.length})
            </Typography>

            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Developer</TableCell>
                    <TableCell>Tier</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Public Key</TableCell>
                    <TableCell>Submitted</TableCell>
                    <TableCell>Updated</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selections.map((selection) => (
                    <TableRow key={selection.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {selection.email}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold" color="primary.main">
                          {selection.tier.toUpperCase()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          fontWeight="bold"
                          color={`${getStatusColor(selection.status)}.main`}
                        >
                          {getStatusText(selection.status)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {selection.publicKey.slice(0, 10)}...{selection.publicKey.slice(-6)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{new Date(selection.createdAt).toLocaleDateString()}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{new Date(selection.updatedAt).toLocaleDateString()}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteClick(selection)}
                            disabled={isDeleting}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Stack>

      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <DeleteIcon sx={{ color: 'error.main' }} />
            <Typography variant="subtitle1" component="div" sx={{ fontWeight: 600 }}>
              Delete Compute Tier Selection
            </Typography>
          </Stack>
        </DialogTitle>

        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="body1">Are you sure you want to delete this compute tier selection?</Typography>

            {selectionToDelete && (
              <Box sx={{ p: 2, backgroundColor: 'background.default', borderRadius: 1 }}>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Developer:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {selectionToDelete.email}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Tier:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {selectionToDelete.tier.toUpperCase()}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Status:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {getStatusText(selectionToDelete.status)}
                    </Typography>
                  </Stack>
                </Stack>
              </Box>
            )}

            <Alert severity="warning">This action cannot be undone. The selection will be permanently deleted.</Alert>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleDeleteCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default observer(AdminPanel);
