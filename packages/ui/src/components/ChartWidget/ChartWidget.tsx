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
};

const Chart = styled(Box)(() => ({
  height: 200,
}));

export const ChartWidget = ({ title, value, history }: ChartWidgetProps) => {
  const theme = useTheme();

  return (
    <Stack spacing={1}>
      <Typography variant="caption" color="text.secondary">
        {title}
      </Typography>
      <Typography fontWeight="bold">{value}</Typography>

      {!!history?.length && (
        <Chart>
          <LineChart
            dataset={history || []}
            axisHighlight={{ x: 'none', y: 'none' }}
            grid={{ horizontal: true, vertical: false }}
            margin={{ top: 10, right: 20, bottom: 40, left: 40 }}
            colors={[theme.palette.primary.main]}
            yAxis={[
              {
                dataKey: 'value',
                disableLine: true,
                disableTicks: true,
                valueFormatter: (value) => size(value).toString(),
                tickLabelStyle: {
                  fontSize: 10,
                },
              },
            ]}
            xAxis={[
              {
                dataKey: 'date',
                min: Math.min(...history.map((record) => +record.date)),
                max: Math.max(...history.map((record) => +record.date)),
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
                valueFormatter: (value) => size(value || 0).toString(),
              },
            ]}
          />
        </Chart>
      )}
    </Stack>
  );
};
