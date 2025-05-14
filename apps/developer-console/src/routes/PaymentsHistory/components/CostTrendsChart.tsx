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

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Convert period string to days for filtering
const getPeriodDays = (periodValue: string): number => {
  switch (periodValue) {
    case 'this_month':
      return 30;
    case 'last_month':
      return 60;
    case 'last_3_months':
      return 90;
    case 'last_year':
      return 365;
    default:
      return parseInt(periodValue, 10) || 30;
  }
};

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
      storage: 0,
      traffic: 0,
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

    const now = Date.now();
    const days = getPeriodDays(store.selectedPeriod);
    const startTimestamp = now - days * 24 * 60 * 60 * 1000;

    const tcaEraDuration = 60 * 1000; // 1 minute in milliseconds
    const paymentEraDuration = 20 * 60 * 1000; // 20 minutes in milliseconds for devnet

    const transformed = data
      .sort((a, b) => a.era - b.era)
      .map((item) => {
        const timestamp = firstTcaTimestampMsFromPaymentEraId(item.era, tcaEraDuration, paymentEraDuration);
        return {
          name: formatDate(timestamp),
          timestamp,
          era: item.era,
          storage:
            ((item.token_estimates?.total_puts_value || 0) + (item.token_estimates?.total_gets_value || 0)) / 200, // convert to dollars
          traffic: (item.token_estimates?.total_traffic_value || 0) / 100, // convert to dollars
        };
      });

    const filtered = transformed.filter((item) => item.timestamp >= startTimestamp);
    console.log('CostTrendsChart - Filtered count:', filtered.length);

    // If we have filtered out all data, return empty chart rather than nothing
    return filtered.length > 0 ? filtered : generateEmptyChartData();
  }, [data, store.selectedPeriod]);

  const isEmpty = data.length === 0;

  return (
    <Card sx={{ p: 3, mb: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" color={isEmpty ? 'text.disabled' : 'text.primary'}>
          Cost Trends
          {isEmpty && ' (No data for selected filters)'}
        </Typography>
      </Stack>

      {/* Always show chart, even if empty */}
      <ChartContainer>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorStorage" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8884d8" stopOpacity={isEmpty ? 0.3 : 0.8} />
                <stop offset="95%" stopColor="#8884d8" stopOpacity={isEmpty ? 0.05 : 0.1} />
              </linearGradient>
              <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#82ca9d" stopOpacity={isEmpty ? 0.3 : 0.8} />
                <stop offset="95%" stopColor="#82ca9d" stopOpacity={isEmpty ? 0.05 : 0.1} />
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
              dataKey="storage"
              stroke="#8884d8"
              strokeOpacity={isEmpty ? 0.5 : 1}
              fillOpacity={1}
              fill="url(#colorStorage)"
              name="Storage"
            />
            <Area
              type="monotone"
              dataKey="traffic"
              stroke="#82ca9d"
              strokeOpacity={isEmpty ? 0.5 : 1}
              fillOpacity={1}
              fill="url(#colorTraffic)"
              name="Traffic"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartContainer>
    </Card>
  );
};

export default observer(CostTrendsChart);
