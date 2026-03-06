import { Box, Typography } from '@cluster-apps/ui';

export const EmptyState = () => (
  <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
    <Typography variant="body1" color="text.secondary">
      No usage data for the selected period.
    </Typography>
  </Box>
);
