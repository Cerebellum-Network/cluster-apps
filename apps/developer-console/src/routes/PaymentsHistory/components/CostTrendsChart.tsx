import { FC, useMemo, useState } from 'react';
import { Box, Card, Typography, Stack } from '@cluster-apps/ui';
import { styled } from '@mui/material/styles';
import { observer } from 'mobx-react-lite';
import { EraDetail } from '@cluster-apps/api';
import { AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, Area, ResponsiveContainer, Legend } from 'recharts';
import { MenuItem, Select, FormControl, InputLabel, SelectChangeEvent } from '@mui/material';
import { firstTcaTimestampMsFromPaymentEraId } from '~/utils/era';

interface CostTrendsChartProps {
  data: EraDetail[];
}

const ChartContainer = styled(Box)({
  height: 300,
  width: '100%',
  paddingTop: 16,
  paddingBottom: 8,
});

const PeriodOptions = [
  { value: '30', label: 'Last 30 days' },
  { value: '60', label: 'Last 60 days' },
  { value: '90', label: 'Last 90 days' },
];

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const CostTrendsChart: FC<CostTrendsChartProps> = ({ data }) => {
  const [period, setPeriod] = useState('30');

  const handlePeriodChange = (event: SelectChangeEvent) => {
    setPeriod(event.target.value);
  };

  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }

    // Sort data by era ID (ascending)
    const sortedData = [...data].sort((a, b) => a.era - b.era);

    return sortedData.map((item) => {
      // Calculate timestamp from era ID
      const tcaEraDuration = 60 * 1000; // 1 minute in milliseconds
      const paymentEraDuration = 20 * 60 * 1000; // 20 minutes in milliseconds for devnet
      const timestamp = firstTcaTimestampMsFromPaymentEraId(item.era, tcaEraDuration, paymentEraDuration);

      // Calculate storage and traffic costs
      const storageCost =
        ((item.token_estimates?.total_puts_value || 0) + (item.token_estimates?.total_gets_value || 0)) / 200; // convert to dollars
      const trafficCost = (item.token_estimates?.total_traffic_value || 0) / 100; // convert to dollars

      return {
        name: formatDate(timestamp),
        storage: storageCost,
        traffic: trafficCost,
        era: item.era,
        timestamp: timestamp, // Keep timestamp for sorting if needed
      };
    });
  }, [data]);

  return (
    <Card sx={{ p: 3, mb: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1">Cost Trends</Typography>
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel id="period-select">Last 30 days</InputLabel>
          <Select
            labelId="period-select"
            value={period}
            label="Last 30 days"
            onChange={handlePeriodChange}
            size="small"
          >
            {PeriodOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {chartData.length > 0 ? (
        <ChartContainer>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorStorage" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#82ca9d" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(value: number) => `$${value.toFixed(2)}`} domain={[0, 'auto']} />
              <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, undefined]} />
              <Legend />
              <Area
                type="monotone"
                dataKey="storage"
                stroke="#8884d8"
                fillOpacity={1}
                fill="url(#colorStorage)"
                name="Storage"
              />
              <Area
                type="monotone"
                dataKey="traffic"
                stroke="#82ca9d"
                fillOpacity={1}
                fill="url(#colorTraffic)"
                name="Traffic"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      ) : (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '300px',
          }}
        >
          <Typography variant="body1" color="text.secondary">
            No cost data available for the selected period
          </Typography>
        </Box>
      )}
    </Card>
  );
};

export default observer(CostTrendsChart);
