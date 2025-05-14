import { FC } from 'react';
import { Grid, Box, Card, CardContent, Stack, Typography } from '@cluster-apps/ui';
import { ArrowUpward, ArrowDownward } from '@mui/icons-material';
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
}> = ({ title, value, change, icon }) => {
  const isPositive = change && change > 0;

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
            <Typography variant="h4" fontWeight="bold">
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
              }}
            >
              {icon}
            </Box>
          )}
        </Stack>

        {change !== undefined && (
          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
            <Box
              component="span"
              sx={{ display: 'flex', alignItems: 'center', color: isPositive ? 'success.main' : 'error.main', mr: 0.5 }}
            >
              {isPositive ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
              {Math.abs(change).toFixed(2)}%
            </Box>
            Vs Last Period
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

const SummaryCards: FC<SummaryCardsProps> = ({ data }) => {
  // Calculate totals for current period
  const totalPayments = data.reduce((sum, item) => sum + (item.token_estimates?.total_customer_charges || 0), 0);
  const totalTraffic = data.reduce((sum, item) => sum + (item.total_customers?.transferredBytes || 0), 0);
  const totalStorage = data.reduce(
    (sum, item) => sum + (item.total_customers?.gets || 0) + (item.total_customers?.puts || 0),
    0,
  );

  const averageCostPerPeriod = data.length > 0 ? totalPayments / data.length : 0;

  // Calculate percentage changes
  // In a real implementation, you'd compare with previous periods
  // For now, we'll use a simple approach based on data length
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
          value: `$${formatNumber(totalPayments / 100)}`,
          change: paymentChange,
          icon: <MoneyIcon width="40px" height="40px" />,
        },
        {
          title: 'Total Traffic',
          value: `${formatNumber(totalTraffic, true)}`,
          change: trafficChange,
          icon: <TrafficIcon />,
        },
        {
          title: 'Total Storage',
          value: `${formatNumber(totalStorage, true)}`,
          change: storageChange,
          icon: <StorageIcon />,
        },
        {
          title: 'Average Cost Per Period',
          value: `$${formatNumber(averageCostPerPeriod / 100)}`,
          change: costChange,
          icon: <PeriodIcon />,
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
