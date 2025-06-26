import { FC } from 'react';
import { Grid, Box, Card, CardContent, Stack, Typography } from '@cluster-apps/ui';
import { ArrowUpward, ArrowDownward, HorizontalRule } from '@mui/icons-material';
import { observer } from 'mobx-react-lite';
import { EraDetail } from '@cluster-apps/api';
import { MoneyIcon, TrafficIcon, StorageIcon, PeriodIcon } from '~/assets/icons';
import { usePaymentHistoryStore } from '~/hooks';

interface SummaryCardsProps {
  data: EraDetail[];
}

const formatNumber = (value: number, isBytes = false): string => {
  if (isBytes) {
    if (value >= 1000000000) {
      return `${(value / 1000000000).toFixed(1)} GB`;
    } else if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)} MB`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)} KB`;
    }
    return `${value} Bytes`;
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const MetricCard: FC<{
  title: string;
  value: string | number;
  change?: number;
  icon?: React.ReactNode;
  isEmpty?: boolean;
}> = ({ title, value, change, icon, isEmpty }) => {
  const isPositive = change && change > 0;

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
            <Typography variant="h4" fontWeight="bold" color={isEmpty ? 'text.disabled' : 'text.primary'}>
              {value}
            </Typography>
          </Box>
          {icon && (
            <Box
              sx={{
                '& > svg': {
                  width: '40px',
                  height: '40px',
                },
                opacity: isEmpty ? 0.5 : 1,
              }}
            >
              {icon}
            </Box>
          )}
        </Stack>

        {change !== undefined && (
          <Typography
            variant="body2"
            sx={{
              display: 'flex',
              alignItems: 'center',
              mt: 1,
              color: isEmpty ? 'text.disabled' : 'inherit',
            }}
          >
            <Box
              component="span"
              sx={{
                display: 'flex',
                alignItems: 'center',
                color: isEmpty ? 'text.disabled' : isPositive ? 'success.main' : 'error.main',
                mr: 0.5,
              }}
            >
              {isEmpty ? (
                <HorizontalRule fontSize="small" />
              ) : isPositive ? (
                <ArrowUpward fontSize="small" />
              ) : (
                <ArrowDownward fontSize="small" />
              )}
              {isEmpty ? '--' : Math.abs(change).toFixed(2) + '%'}
            </Box>
            Vs Last Period
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

const SummaryCards: FC<SummaryCardsProps> = ({ data }) => {
  const store = usePaymentHistoryStore();
  const isEmpty = data.length === 0;
  const era = data.length > 0 ? data[0] : null;

  // Calculate totals for selected buckets
  let totalPayments = 0;
  let totalTraffic = 0;
  let totalStorage = 0;

  if (era && store.selectedBucketIds.length > 0) {
    // Sum up values for all selected buckets
    store.selectedBucketIds.forEach((bucketId) => {
      // Add cost if available in token estimates
      if (era.token_estimates?.bucket_estimates && bucketId in era.token_estimates.bucket_estimates) {
        totalPayments += era.token_estimates.bucket_estimates[bucketId].total_value || 0;
      }

      // Add traffic and storage operations if bucket exists
      if (era.buckets && bucketId in era.buckets) {
        const bucketData = era.buckets[bucketId];
        totalTraffic += bucketData.transferredBytes || 0;
        totalStorage += (bucketData.gets || 0) + (bucketData.puts || 0);
      }
    });
  } else if (era) {
    // Fallback to total values if no buckets selected
    totalPayments = era.token_estimates.total_customer_charges || 0;
    totalTraffic = era.total_buckets?.transferredBytes || era.total_customers?.transferredBytes || 0;
    totalStorage =
      (era.total_buckets?.gets || 0) + (era.total_buckets?.puts || 0) ||
      (era.total_customers?.gets || 0) + (era.total_customers?.puts || 0);
  }

  // Calculate cost per period (we're looking at a single era now)
  const costPerPeriod = totalPayments;

  // Dummy change values (could be improved with historical data)
  const paymentChange = 5.2; // Example percentage change
  const trafficChange = 3.8;
  const storageChange = -1.2;
  const costChange = 4.5;

  return (
    <Grid container spacing={3} sx={{ mb: 4 }}>
      {[
        {
          title: 'Total Payments',
          value: isEmpty ? '$0.00' : `$${formatNumber(totalPayments / 100000)}`,
          change: paymentChange,
          icon: <MoneyIcon width="40px" height="40px" />,
          isEmpty,
        },
        {
          title: 'Total Traffic',
          value: isEmpty ? '0 Bytes' : `${formatNumber(totalTraffic, true)}`,
          change: trafficChange,
          icon: <TrafficIcon />,
          isEmpty,
        },
        {
          title: 'Total Storage Operations',
          value: isEmpty ? '0' : `${totalStorage}`,
          change: storageChange,
          icon: <StorageIcon />,
          isEmpty,
        },
        {
          title: 'Cost This Period',
          value: isEmpty ? '$0.00' : `$${formatNumber(costPerPeriod / 100000)}`,
          change: costChange,
          icon: <PeriodIcon />,
          isEmpty,
        },
      ].map((item, index) => (
        <Grid item xs={12} sm={6} md={6} xl={3} lg={6} key={index}>
          <Box height="100%">
            <MetricCard {...item} />
          </Box>
        </Grid>
      ))}
    </Grid>
  );
};

export default observer(SummaryCards);
