import { useMemo } from 'react';
import { Box, Card, Stack, Typography } from '@cluster-apps/ui';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from 'recharts';
import { CustomerEraRecord, MetricKey, METRIC_LABELS } from '@cluster-apps/api';
import { formatCurrency, formatDecimal } from '~/utils/formatters';
import { MetricSelector } from './MetricSelector';

interface UsageChartCardProps {
  data: CustomerEraRecord[];
  selectedMetric: MetricKey;
  onMetricChange: (key: MetricKey) => void;
}

const CHARGE_COLOR = '#6a5acd';

const METRIC_COLORS: Record<MetricKey, string> = {
  charge: CHARGE_COLOR,
  cpu_units: '#2e8b57',
  gpu_units: '#c73e1d',
  ram_units: '#b8860b',
  gets: '#0066cc',
  puts: '#00796b',
  transferred_bytes: '#c62828',
};

function toNumericValue(record: CustomerEraRecord, metric: MetricKey): number {
  const raw = record[metric];
  return typeof raw === 'string' ? parseFloat(raw) : raw;
}

export const UsageChartCard = ({ data, selectedMetric, onMetricChange }: UsageChartCardProps) => {
  const chartData = useMemo(
    () =>
      data.map((record) => ({
        era_id: record.era_id,
        charge: parseFloat(record.charge),
        metric: toNumericValue(record, selectedMetric),
      })),
    [data, selectedMetric],
  );

  const metricLabel = METRIC_LABELS[selectedMetric];
  const metricColor = METRIC_COLORS[selectedMetric];

  return (
    <Card sx={{ p: 3, mb: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="subtitle1">Usage Trends</Typography>
        <MetricSelector value={selectedMetric} onChange={onMetricChange} />
      </Stack>

      <Box role="img" aria-label={`Usage trend chart showing ${metricLabel} and Amount Charged`}>
        {/* Amount Charged */}
        <Box sx={{ mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
            Amount Charged ($)
          </Typography>
        </Box>
        <Box sx={{ height: 180, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              accessibilityLayer
              syncId="usage"
              data={chartData}
              margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gradCharge" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHARGE_COLOR} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHARGE_COLOR} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="era_id" hide />
              <YAxis
                width={60}
                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <RechartsTooltip
                formatter={(v: number) => [formatCurrency(v), 'Amount Charged']}
                labelFormatter={(id: number) => `Era ${id}`}
                contentStyle={{ fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="charge"
                stroke={CHARGE_COLOR}
                strokeWidth={2}
                fill="url(#gradCharge)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>

        {/* Selected Metric */}
        <Box sx={{ mt: 1, mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
            {metricLabel}
          </Typography>
        </Box>
        <Box sx={{ height: 180, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              accessibilityLayer
              syncId="usage"
              data={chartData}
              margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gradMetric" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={metricColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={metricColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="era_id"
                tickFormatter={(id: number) => `${id}`}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                width={60}
                tickFormatter={(v: number) => formatDecimal(v)}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <RechartsTooltip
                formatter={(v: number) => [formatDecimal(v), metricLabel]}
                labelFormatter={(id: number) => `Era ${id}`}
                contentStyle={{ fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="metric"
                stroke={metricColor}
                strokeWidth={2}
                fill="url(#gradMetric)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      </Box>
    </Card>
  );
};
