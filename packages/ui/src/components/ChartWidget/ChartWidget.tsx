import { ReactNode } from 'react';
import { Box, Stack, Typography, styled, useTheme } from '@mui/material';
import { LineChart } from '@mui/x-charts';
import size from 'byte-size';
import { format } from 'date-fns';

type ChartWidgetHistoryRecord = {
  date: Date;
  value: number;
};

export type ChartWidgetProps = {
  title: string;
  value?: ReactNode;
  history?: ChartWidgetHistoryRecord[];
  formatValue?: (value: number) => string;
};

const Chart = styled(Box)(() => ({
  height: 200,
}));

export const ChartWidget = ({
  title,
  value,
  history,
  formatValue = (value) => size(value || 0).toString(),
}: ChartWidgetProps) => {
  const theme = useTheme();

  return (
    <Stack spacing={1}>
      <Typography variant="caption" color="text.secondary">
        {title}
      </Typography>
      <Typography fontWeight="bold">{value}</Typography>

      <Chart>
        <LineChart
          dataset={history || []}
          axisHighlight={{ x: 'none', y: 'none' }}
          grid={{ horizontal: true, vertical: false }}
          margin={{ top: 10, right: 20, bottom: 40, left: 40 }}
          colors={[theme.palette.primary.main]}
          slots={{
            noDataOverlay: () => null,
          }}
          yAxis={[
            {
              dataKey: 'value',
              disableLine: true,
              disableTicks: true,
              min: history?.length ? undefined : 0,
              max: history?.length ? undefined : 100,
              tickNumber: history?.length ? undefined : 5,
              valueFormatter: (value) => formatValue(value || 0),
              tickLabelStyle: {
                fontSize: 10,
              },
            },
          ]}
          xAxis={[
            {
              dataKey: 'date',
              min: history && Math.min(...history.map((record) => +record.date)),
              max: history && Math.max(...history.map((record) => +record.date)),
              disableLine: true,
              disableTicks: true,
              valueFormatter: (date) => format(date, 'do MMM'),
              tickPlacement: 'end',
              tickNumber: 1,

              tickLabelStyle: {
                fontSize: 10,
                transform: 'translate(-16px, 16px) rotate(-30deg)',
              },
            },
          ]}
          series={[
            {
              curve: 'linear',
              dataKey: 'value',
              showMark: false,
              valueFormatter: (value) => formatValue(value || 0),
            },
          ]}
        />
      </Chart>
    </Stack>
  );
};
