import { format, startOfDay, subHours, subWeeks, subMonths } from 'date-fns';
import { LineChart } from '@mui/x-charts';
import { Box, Card, CardHeader, CardMedia, Divider, Stack, styled, Typography, useTheme } from '@mui/material';

import { PeriodSelect, MetricsPeriod } from './PeriodSelect';
import { useMemo, useState } from 'react';
import { BytesSize } from '../BytesSize';

type MetricsHistoryRecord = {
  storedBytes: number;
  transferredBytes: number;
  puts: number;
  gets: number;
  recordTime: Date;
};

export type MetricsChartProps = {
  history?: MetricsHistoryRecord[];
};

const mapPeriodToFromDate = (period: MetricsPeriod = 'month') => {
  const date = new Date();

  if (period === 'hour') {
    return subHours(date, 1);
  }

  if (period === 'day') {
    return subHours(date, 24);
  }

  if (period === 'week') {
    return startOfDay(subWeeks(date, 1));
  }

  return startOfDay(subMonths(date, 1));
};

const Chart = styled(LineChart)({
  height: 320,
  marginBottom: 16,
});

/**
 * TODO: Refactor this component to use shared graphs configuration
 */
export const MetricsChart = ({ history = [] }: MetricsChartProps) => {
  const theme = useTheme();
  const [period, setPeriod] = useState<MetricsPeriod>('day');
  const periodFrom = useMemo(() => mapPeriodToFromDate(period), [period]);
  const periodHistory = useMemo(
    () => history.filter((record) => record.recordTime > periodFrom),
    [history, periodFrom],
  );

  const total = useMemo(
    () =>
      periodHistory.reduce(
        (acc, record) => ({
          gets: acc.gets + record.gets,
          puts: acc.puts + record.puts,
          storedBytes: acc.storedBytes + record.storedBytes,
          transferredBytes: acc.transferredBytes + record.transferredBytes,
        }),
        { gets: 0, puts: 0, storedBytes: 0, transferredBytes: 0 } as Omit<MetricsHistoryRecord, 'recordTime'>,
      ),
    [periodHistory],
  );

  return (
    <Card>
      <CardHeader title="GET / PUT Requests" action={<PeriodSelect value={period} onChange={setPeriod} />} />
      <CardMedia>
        <Chart
          skipAnimation
          dataset={periodHistory || []}
          axisHighlight={{ x: 'none', y: 'none' }}
          grid={{ horizontal: true, vertical: false }}
          margin={{ top: 10, right: 20, bottom: 40, left: 40 }}
          colors={[theme.palette.primary.main, theme.palette.success.main]}
          slotProps={{
            noDataOverlay: {
              message: 'Upload your data and see the usage',

              style: {
                ...theme.typography.h4,
              },
            },
          }}
          yAxis={[
            {
              min: periodHistory.length ? undefined : 0,
              max: periodHistory.length ? undefined : 100,
              tickNumber: periodHistory.length ? undefined : 5,
              disableLine: true,
              disableTicks: true,
              tickLabelStyle: {
                fontSize: 10,
              },
            },
          ]}
          xAxis={[
            {
              dataKey: 'recordTime',
              min: periodFrom,
              max: new Date(),
              disableLine: true,
              disableTicks: true,
              valueFormatter: (date) => format(date, 'do MMM'),
              tickMinStep: 3600 * 1000 * 24, // min step: 24h

              tickLabelStyle: {
                fontSize: 10,
                transform: 'translate(-16px, 16px) rotate(-30deg)',
              },
            },
          ]}
          series={[
            {
              curve: 'linear',
              dataKey: 'gets',
              showMark: false,
            },

            {
              curve: 'linear',
              dataKey: 'puts',
              showMark: false,
            },
          ]}
        />
        <Stack direction="row" spacing={2} marginY={3} justifyContent="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 14, height: 14, borderRadius: '4px', backgroundColor: theme.palette.primary.main }} />
            <Typography>Gets</Typography>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 14, height: 14, borderRadius: '4px', backgroundColor: theme.palette.success.main }} />
            <Typography>Puts</Typography>
          </Stack>
        </Stack>
      </CardMedia>
      <CardMedia>
        <Divider flexItem />
        <Stack direction="row" spacing={2} padding={2}>
          <Stack direction="row" spacing={1}>
            <Typography variant="body2" color="secondary">
              GET Requests per account
            </Typography>
            <Typography variant="subtitle1">{total.gets}</Typography>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Typography variant="body2" color="secondary">
              PUT Requests per account
            </Typography>
            <Typography variant="subtitle1">{total.puts}</Typography>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Typography variant="body2" color="secondary">
              Total Consumed per account
            </Typography>
            <Typography variant="subtitle1">
              <BytesSize bytes={total.transferredBytes} />
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Typography variant="body2" color="secondary">
              Total Stored per account
            </Typography>
            <Typography variant="subtitle1">
              <BytesSize bytes={total.storedBytes} />
            </Typography>
          </Stack>
        </Stack>
      </CardMedia>
    </Card>
  );
};
