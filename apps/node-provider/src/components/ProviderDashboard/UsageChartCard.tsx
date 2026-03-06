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
import { ProviderEraRecord, ProviderMetricKey, PROVIDER_METRIC_LABELS } from '@cluster-apps/api';
import { formatCurrency, formatDecimal, computeScaleFactor } from '~/utils/formatters';
import { MetricSelector } from './MetricSelector';

interface UsageChartCardProps {
  data: ProviderEraRecord[];
  selectedMetric: ProviderMetricKey;
  onMetricChange: (key: ProviderMetricKey) => void;
}

const REWARD_COLOR = '#6a5acd';

const METRIC_COLORS: Record<ProviderMetricKey, string> = {
  reward: REWARD_COLOR,
  cpu_units: '#2e8b57',
  gpu_units: '#c73e1d',
  ram_units: '#b8860b',
  gets: '#0066cc',
  puts: '#00796b',
  transferred_bytes: '#c62828',
};

function toNumericValue(record: ProviderEraRecord, metric: ProviderMetricKey): number {
  const raw = record[metric];
  return typeof raw === 'string' ? parseFloat(raw) : raw;
}

const tickProps = { fontSize: 11 } as const;
const axisProps = { axisLine: false, tickLine: false } as const;

export const UsageChartCard = ({ data, selectedMetric, onMetricChange }: UsageChartCardProps) => {
  const rawRewards = useMemo(() => data.map((r) => parseFloat(r.reward)), [data]);
  const rewardScale = useMemo(() => computeScaleFactor(rawRewards), [rawRewards]);

  const rawMetrics = useMemo(() => data.map((r) => toNumericValue(r, selectedMetric)), [data, selectedMetric]);
  const metricScale = useMemo(() => computeScaleFactor(rawMetrics), [rawMetrics]);

  const chartData = useMemo(
    () =>
      data.map((record, i) => ({
        era_id: record.era_id,
        reward: rawRewards[i] / rewardScale.divisor,
        metric: rawMetrics[i] / metricScale.divisor,
      })),
    [data, rawRewards, rawMetrics, rewardScale.divisor, metricScale.divisor],
  );

  const metricLabel = PROVIDER_METRIC_LABELS[selectedMetric];
  const metricColor = METRIC_COLORS[selectedMetric];

  const rewardAxisLabel = `Reward Earned ($${rewardScale.label})`;
  const metricAxisLabel = `${metricLabel}${metricScale.label}`;

  return (
    <Card sx={{ p: 3, mb: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="subtitle1">Usage Trends</Typography>
        <MetricSelector value={selectedMetric} onChange={onMetricChange} />
      </Stack>

      <Box role="img" aria-label={`Usage trend chart showing ${metricLabel} and Reward Earned`}>
        <Box sx={{ mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
            {rewardAxisLabel}
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
                <linearGradient id="gradReward" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={REWARD_COLOR} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={REWARD_COLOR} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="era_id" hide />
              <YAxis
                width={60}
                tickFormatter={(v: number) => v.toFixed(1)}
                tick={tickProps}
                {...axisProps}
              />
              <RechartsTooltip
                formatter={(v: number) => [formatCurrency(v * rewardScale.divisor), 'Reward Earned']}
                labelFormatter={(id: number) => `Era ${id}`}
                contentStyle={{ fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="reward"
                stroke={REWARD_COLOR}
                strokeWidth={2}
                fill="url(#gradReward)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>

        <Box sx={{ mt: 1, mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
            {metricAxisLabel}
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
                tick={tickProps}
                {...axisProps}
              />
              <YAxis
                width={60}
                tickFormatter={(v: number) => formatDecimal(v)}
                tick={tickProps}
                {...axisProps}
              />
              <RechartsTooltip
                formatter={(v: number) => [formatDecimal(v * metricScale.divisor), metricLabel]}
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
