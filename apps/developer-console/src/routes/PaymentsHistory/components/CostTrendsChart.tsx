import { FC, useMemo } from 'react';
import { Box, Card, Stack, Typography } from '@cluster-apps/ui';
import { styled } from '@mui/material/styles';
import { observer } from 'mobx-react-lite';
import { EraDetail } from '@cluster-apps/api';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { firstTcaTimestampMsFromPaymentEraId } from '~/utils/era';
import { usePaymentHistoryStore } from '~/hooks';

interface CostTrendsChartProps {
  data: EraDetail[];
}

const ChartContainer = styled(Box)({
  height: 300,
  width: '100%',
  paddingTop: 16,
  paddingBottom: 8,
});

// const formatDate = (timestamp: number) => {
//   const date = new Date(timestamp);
//   return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
// };

// Convert period string to days for filtering
// const getPeriodDays = (periodValue: string): number => {
//   switch (periodValue) {
//     case 'this_month':
//       return 30;
//     case 'last_month':
//       return 60;
//     case 'last_3_months':
//       return 90;
//     case 'last_year':
//       return 365;
//     default:
//       return parseInt(periodValue, 10) || 30;
//   }
// };

// Generate empty chart data for visualization
const generateEmptyChartData = () => {
  const now = new Date();
  const data = [];

  // Create empty data points for the last 5 days
  for (let i = 4; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      name: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      timestamp: date.getTime(),
      storageOps: 0,
      traffic: 0,
      total: 0,
    });
  }

  return data;
};

const CostTrendsChart: FC<CostTrendsChartProps> = ({ data }) => {
  const store = usePaymentHistoryStore();

  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      console.log('CostTrendsChart - No data, generating empty chart');
      return generateEmptyChartData();
    }

    console.log('CostTrendsChart - Rendering with period:', store.selectedPeriod);
    console.log('CostTrendsChart - Data count:', data.length);
    console.log('CostTrendsChart - Selected buckets:', store.selectedBucketIds);

    // Since we're working with a single era primarily, create a chart showing
    // cost breakdown for each selected bucket
    const transformed = data.map((era) => {
      const bucketDataPoints: any[] = [];

      // If we have selected buckets, create a data point for each
      if (store.selectedBucketIds.length > 0) {
        store.selectedBucketIds.forEach((bucketId) => {
          const bucketCosts = { gets: 0, puts: 0, traffic: 0, total: 0 };

          // Get costs from token estimates
          if (era.token_estimates?.bucket_estimates && bucketId in era.token_estimates.bucket_estimates) {
            const estimates = era.token_estimates.bucket_estimates[bucketId];
            bucketCosts.gets = estimates.gets_value || 0;
            bucketCosts.puts = estimates.puts_value || 0;
            bucketCosts.traffic = estimates.traffic_value || 0;
            bucketCosts.total = estimates.total_value || 0;
          }

          // Get usage data
          let storage = 0;
          let traffic = 0;
          if (era.buckets && bucketId in era.buckets) {
            const bucketData = era.buckets[bucketId];
            storage = (bucketData.gets || 0) + (bucketData.puts || 0);
            traffic = bucketData.transferredBytes || 0;
          }

          // Create a data point for this bucket
          bucketDataPoints.push({
            name: `Bucket ${bucketId.substring(0, 8)}...`,
            bucketId: bucketId,
            timestamp: firstTcaTimestampMsFromPaymentEraId(era.era, 60 * 1000, 20 * 60 * 1000),
            storage: storage,
            traffic: Math.round((traffic / 1024 / 1024) * 100) / 100, // MB
            storageOps: Math.round(bucketCosts.gets + bucketCosts.puts) / 100000,
            trafficCost: bucketCosts.traffic / 100000,
            total: bucketCosts.total / 100000,
          });
        });

        return bucketDataPoints;
      } else {
        // If no buckets selected, create a data point for the era total
        const totalCosts = {
          gets: era.token_estimates?.total_gets_value || 0,
          puts: era.token_estimates?.total_puts_value || 0,
          traffic: era.token_estimates?.total_traffic_value || 0,
          total: era.token_estimates?.total_customer_charges || 0,
        };

        return [
          {
            name: `Era ${era.era}`,
            eraId: era.era,
            timestamp: firstTcaTimestampMsFromPaymentEraId(era.era, 60 * 1000, 20 * 60 * 1000),
            storageOps: (totalCosts.gets + totalCosts.puts) / 100000,
            trafficCost: totalCosts.traffic / 100000,
            total: totalCosts.total / 100000,
          },
        ];
      }
    });

    // Flatten the array of arrays
    const flattenedData = transformed.flat();

    // If we have no data, return empty chart
    return flattenedData.length > 0 ? flattenedData : generateEmptyChartData();
  }, [data, store.selectedBucketIds, store.selectedPeriod]);

  const isEmpty = data.length === 0 || chartData.length === 0;

  return (
    <Card sx={{ p: 3, mb: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" color={isEmpty ? 'text.disabled' : 'text.primary'}>
          {store.selectedBucketIds.length > 0 ? 'Cost Breakdown by Bucket' : 'Cost Breakdown (Selected Era)'}
          {isEmpty && ' (No data for selected filters)'}
        </Typography>
      </Stack>

      {/* Always show chart, even if empty */}
      <ChartContainer>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorStorageOps" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8884d8" stopOpacity={isEmpty ? 0.3 : 0.8} />
                <stop offset="95%" stopColor="#8884d8" stopOpacity={isEmpty ? 0.05 : 0.1} />
              </linearGradient>
              <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#82ca9d" stopOpacity={isEmpty ? 0.3 : 0.8} />
                <stop offset="95%" stopColor="#82ca9d" stopOpacity={isEmpty ? 0.05 : 0.1} />
              </linearGradient>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff8042" stopOpacity={isEmpty ? 0.3 : 0.8} />
                <stop offset="95%" stopColor="#ff8042" stopOpacity={isEmpty ? 0.05 : 0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={isEmpty ? 0.5 : 1} />
            <XAxis dataKey="name" opacity={isEmpty ? 0.5 : 1} />
            <YAxis
              tickFormatter={(value: number) => `$${value.toFixed(2)}`}
              domain={[0, 'auto']}
              opacity={isEmpty ? 0.5 : 1}
            />
            <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, undefined]} />
            <Legend />
            <Area
              type="monotone"
              dataKey="storageOps"
              stroke="#8884d8"
              strokeOpacity={isEmpty ? 0.5 : 1}
              fillOpacity={1}
              fill="url(#colorStorageOps)"
              name="Storage Operations"
            />
            <Area
              type="monotone"
              dataKey="trafficCost"
              stroke="#82ca9d"
              strokeOpacity={isEmpty ? 0.5 : 1}
              fillOpacity={1}
              fill="url(#colorTraffic)"
              name="Traffic"
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#ff8042"
              strokeOpacity={isEmpty ? 0.5 : 1}
              fillOpacity={1}
              fill="url(#colorTotal)"
              name="Total Cost"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartContainer>
    </Card>
  );
};

export default observer(CostTrendsChart);
