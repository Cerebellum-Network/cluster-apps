import { ReactNode } from 'react';
import { Box, Stack, Typography, styled } from '@mui/material';

import { ClockIcon } from '../../icons';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - TODO: remove this tmp image when real graph is implemented
import graphImage from './graph.png';

export type ChartWidgetProps = {
  title: string;
  value?: ReactNode;
};

const Chart = styled(Box)(() => ({
  backgroundImage: `url(${graphImage})`,
  backgroundSize: 'cover',
  backgroundPositionX: -20,
}));

const ComingSoon = styled(Stack)(() => ({
  alignItems: 'center',
  justifyContent: 'center',
  height: 150,
  backgroundColor: '#F5F7FADD',
}));

export const ChartWidget = ({ title, value }: ChartWidgetProps) => (
  <Stack spacing={1}>
    <Typography variant="caption" color="text.secondary">
      {title}
    </Typography>
    <Typography fontWeight="bold">{value}</Typography>
    <Chart>
      <ComingSoon spacing={1}>
        <ClockIcon fontSize="small" />
        <Typography variant="caption">Coming Soon: Graphs</Typography>
      </ComingSoon>
    </Chart>
  </Stack>
);
