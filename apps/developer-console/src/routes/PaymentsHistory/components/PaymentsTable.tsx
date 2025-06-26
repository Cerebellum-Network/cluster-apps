import { FC, useState } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
} from '@cluster-apps/ui';
import { TablePagination, Chip } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { EraDetail } from '@cluster-apps/api';
import { firstTcaTimestampMsFromPaymentEraId } from '~/utils/era';
import { usePaymentHistoryStore } from '~/hooks';

interface PaymentsTableProps {
  data: EraDetail[];
}

const PaymentsTable: FC<PaymentsTableProps> = ({ data }) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const store = usePaymentHistoryStore();

  const handleChangePage = (_event: React.MouseEvent<HTMLButtonElement> | null, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const formatDate = (eraId: number) => {
    // Calculate timestamp from era ID using utility function
    const tcaEraDuration = 60 * 1000; // 1 minute in milliseconds
    const paymentEraDuration = 20 * 60 * 1000; // 20 minutes in milliseconds for devnet
    const timestampMs = firstTcaTimestampMsFromPaymentEraId(eraId, tcaEraDuration, paymentEraDuration);

    return new Date(timestampMs).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatAmount = (amount: number) => {
    return `$${(amount / 100000).toFixed(2)}`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes >= 1000000000) {
      return `${(bytes / 1000000000).toFixed(1)} GB`;
    } else if (bytes >= 1000000) {
      return `${(bytes / 1000000).toFixed(1)} MB`;
    } else if (bytes >= 1000) {
      return `${(bytes / 1000).toFixed(1)} KB`;
    }
    return `${bytes} B`;
  };

  const formatOperations = (count: number) => {
    return count.toLocaleString();
  };

  const getStatusColor = (status: string): 'success' | 'warning' | 'error' => {
    switch (status) {
      case 'paid':
        return 'success';
      case 'pending':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'warning';
    }
  };

  // Calculate total cost for selected buckets in a given era
  const getSelectedBucketsCost = (era: EraDetail): number => {
    let totalCost = 0;

    if (era.token_estimates?.bucket_estimates && store.selectedBucketIds.length > 0) {
      store.selectedBucketIds.forEach((bucketId) => {
        if (bucketId in era.token_estimates.bucket_estimates) {
          totalCost += era.token_estimates.bucket_estimates[bucketId].total_value || 0;
        }
      });
    } else if (store.selectedBucketIds.length === 0) {
      // If no buckets selected, show total cost
      totalCost = era.token_estimates?.total_customer_charges || 0;
    }

    return totalCost;
  };

  // Calculate total operations and traffic for selected buckets
  const getSelectedBucketsStats = (era: EraDetail): { operations: number; traffic: number } => {
    let operations = 0;
    let traffic = 0;

    if (era.buckets && store.selectedBucketIds.length > 0) {
      store.selectedBucketIds.forEach((bucketId) => {
        if (bucketId in era.buckets) {
          const bucketData = era.buckets[bucketId];
          operations += (bucketData.gets || 0) + (bucketData.puts || 0);
          traffic += bucketData.transferredBytes || 0;
        }
      });
    } else if (store.selectedBucketIds.length === 0) {
      // If no buckets selected, show totals
      operations = (era.total_buckets?.gets || 0) + (era.total_buckets?.puts || 0);
      traffic = era.total_buckets?.transferredBytes || 0;

      if (operations === 0) {
        operations = (era.total_customers?.gets || 0) + (era.total_customers?.puts || 0);
      }
      if (traffic === 0) {
        traffic = era.total_customers?.transferredBytes || 0;
      }
    }

    return { operations, traffic };
  };

  return (
    <Box>
      <Typography variant="h3" sx={{ mb: 2 }}>
        Payments history{' '}
        {store.selectedBucketIds.length > 0
          ? `(${store.selectedBucketIds.length} bucket${store.selectedBucketIds.length > 1 ? 's' : ''})`
          : '(All buckets)'}
      </Typography>
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label="payments history table">
          <TableHead>
            <TableRow>
              <TableCell>Era ID</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Operations</TableCell>
              <TableCell>Traffic</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row) => {
              // All records in the table are considered paid
              const status = 'paid';
              const cost = getSelectedBucketsCost(row);
              const { operations, traffic } = getSelectedBucketsStats(row);

              return (
                <TableRow key={row.era} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                  <TableCell component="th" scope="row">
                    {row.era}
                  </TableCell>
                  <TableCell>{formatDate(row.era)}</TableCell>
                  <TableCell>{formatAmount(cost)}</TableCell>
                  <TableCell>{formatOperations(operations)}</TableCell>
                  <TableCell>{formatBytes(traffic)}</TableCell>
                  <TableCell>
                    <Chip label={status} color={getStatusColor(status)} size="small" />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={data.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />

      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Showing {Math.min(data.length, page * rowsPerPage + 1)} - {Math.min(data.length, (page + 1) * rowsPerPage)} of{' '}
          {data.length} Payments
        </Typography>
      </Box>
    </Box>
  );
};

export default observer(PaymentsTable);
