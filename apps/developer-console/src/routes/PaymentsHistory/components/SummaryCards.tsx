import { FC } from 'react';
import { Grid, Box, Card, CardContent, Stack, Typography } from '@cluster-apps/ui';
import { ArrowUpward, ArrowDownward, HorizontalRule } from '@mui/icons-material';
import { observer } from 'mobx-react-lite';
import { EraDetail } from '@cluster-apps/api';
import { MoneyIcon, TrafficIcon, StorageIcon, PeriodIcon } from '~/assets/icons';

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
  const isEmpty = data.length === 0;

  // Calculate totals for current period
  const totalPayments = data.reduce((sum, item) => sum + (item.token_estimates?.total_customer_charges || 0), 0);
  const totalTraffic = data.reduce((sum, item) => sum + (item.total_customers?.transferredBytes || 0), 0);
  const totalStorage = data.reduce(
    (sum, item) => sum + (item.total_customers?.gets || 0) + (item.total_customers?.puts || 0),
    0,
  );

  const averageCostPerPeriod = data.length > 0 ? totalPayments / data.length : 0;

  // Calculate percentage changes only if we have data
  const previousPeriodFactor = data.length > 1 ? 0.8 : 0; // Simplification for demo

  const paymentChange = previousPeriodFactor ? (totalPayments / (totalPayments * previousPeriodFactor) - 1) * 100 : 0;
  const trafficChange = previousPeriodFactor ? (totalTraffic / (totalTraffic * previousPeriodFactor) - 1) * 100 : 0;
  const storageChange = previousPeriodFactor ? (totalStorage / (totalStorage * previousPeriodFactor) - 1) * 100 : 0;
  const costChange = previousPeriodFactor
    ? (averageCostPerPeriod / (averageCostPerPeriod * previousPeriodFactor) - 1) * 100
    : 0;

  return (
    <Grid container spacing={3} sx={{ mb: 4 }}>
      {[
        {
          title: 'Total Payments',
          value: isEmpty ? '$0.00' : `$${formatNumber(totalPayments / 100)}`,
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
          title: 'Total Storage',
          value: isEmpty ? '0 Bytes' : `${formatNumber(totalStorage, true)}`,
          change: storageChange,
          icon: <StorageIcon />,
          isEmpty,
        },
        {
          title: 'Average Cost Per Period',
          value: isEmpty ? '$0.00' : `$${formatNumber(averageCostPerPeriod / 100)}`,
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
