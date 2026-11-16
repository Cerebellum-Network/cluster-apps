import { Box, Typography, Stack, TextField, MenuItem, styled } from '@cluster-apps/ui';
import { useState } from 'react';

/**
 * Inference → Usage (mockup: "a month later" — requests at once vs the plan
 * limit, refusals by cause, use by model). The per-model usage/limit feed is not
 * wired yet (it reads from the bills + a limits service), so this is the page
 * shell with an honest empty state; the charts and table land with that data.
 */
const PERIODS = ['Last 7 days', 'Last 30 days', 'This month'];

const Empty = styled(Box)(({ theme }) => ({
  border: `1px dashed ${theme.palette.divider}`,
  borderRadius: 12,
  padding: theme.spacing(8, 4),
  textAlign: 'center',
}));

const Usage = () => {
  const [period, setPeriod] = useState(PERIODS[1]);

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" marginBottom="20px">
        <Typography variant="h3">Usage</Typography>
        <TextField
          select
          label="Period"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          size="small"
          sx={{ minWidth: 170 }}
        >
          {PERIODS.map((p) => (
            <MenuItem key={p} value={p}>
              {p}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Empty>
        <Typography variant="subtitle1" marginBottom="8px">
          No usage to show yet
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460, marginX: 'auto' }}>
          Requests at once against your limit, refusals by cause and use by model will appear here once your account has a
          month of activity.
        </Typography>
      </Empty>
    </Box>
  );
};

export default Usage;
