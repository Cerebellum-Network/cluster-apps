import { useEffect, useState } from 'react';
import { useAccount } from '~/hooks';
import {
  Paper,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  CircularProgress,
  Box,
} from '@mui/material';
import { Wallet as WalletIcon } from '@mui/icons-material';

const TopUpHistory = () => {
  let account;
  let accountId;
  try {
    account = useAccount();
    accountId = account.address;
  } catch (e) {
    accountId = undefined;
  }
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!accountId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    fetch(`http://localhost:3000/transaction-history/${accountId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch transaction history');
        return res.json();
      })
      .then(setHistory)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [accountId]);

  if (!accountId) return (
    <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#fff3f3' }}>
      <Typography color="error" variant="body1">
        No account detected. Please log in or select an account to view your top-up history.
      </Typography>
    </Paper>
  );
  if (loading)
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  if (error)
    return (
      <Paper sx={{ p: 3, textAlign: 'center', bgcolor: '#fff3f3' }}>
        <Typography color="error" variant="body1">
          {error}
        </Typography>
      </Paper>
    );
  if (!history.length)
    return (
      <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f8f9fa' }}>
        <WalletIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          No Top-Up History
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Your top-up transactions will appear here once you make your first payment.
        </Typography>
      </Paper>
    );

  return (
    <Paper sx={{ mt: 2, p: 2 }}>
      <Typography variant="subtitle1" gutterBottom>
        Top-Up History
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Amount (USD)</TableCell>
            <TableCell>Amount (CERE)</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Type</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {history.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell>{new Date(tx.created_at).toLocaleString()}</TableCell>
              <TableCell>${tx.amount_usd.toFixed(2)}</TableCell>
              <TableCell>{tx.amount_cere.toFixed(2)}</TableCell>
              <TableCell>
                <Chip
                  label={tx.status}
                  color={tx.status === 'completed' ? 'success' : tx.status === 'pending' ? 'warning' : 'error'}
                  size="small"
                />
              </TableCell>
              <TableCell>
                <Chip
                  label={tx.transaction_type === 'auto' ? 'Auto Top-Up' : 'Manual'}
                  color={tx.transaction_type === 'auto' ? 'primary' : 'default'}
                  size="small"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
};

export default TopUpHistory; 