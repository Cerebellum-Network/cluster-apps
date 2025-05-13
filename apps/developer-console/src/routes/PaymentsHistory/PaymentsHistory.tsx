import { observer } from 'mobx-react-lite';
import { FC, useEffect } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@cluster-apps/ui';
import { FilterSection, SummaryCards, CostTrendsChart, UsageByBucket, PaymentsTable } from './components';
import { paymentsHistoryStore } from './store';

const PaymentsHistory: FC = () => {
  const store = paymentsHistoryStore;

  useEffect(() => {
    // Initial data fetch is handled in the store constructor
    return () => {
      // Cleanup if needed
    };
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h3" sx={{ mb: 4 }}>
        Payments analytics
      </Typography>

      <FilterSection store={store} />

      {store.isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {store.error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {store.error}
        </Alert>
      )}

      {!store.isLoading && !store.error && store.eraData.length > 0 && (
        <>
          <SummaryCards data={store.eraData} />

          <Box display="flex" gap={3} sx={{ mb: 4 }}>
            <Box flex={1}>
              <CostTrendsChart data={store.eraData} />
            </Box>
            <Box flex={1}>
              <UsageByBucket data={store.eraData} />
            </Box>
          </Box>

          <PaymentsTable data={store.eraData} />
        </>
      )}

      {!store.isLoading && !store.error && store.eraData.length === 0 && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '300px',
            border: '1px dashed grey',
            borderRadius: 2,
          }}
        >
          <Typography variant="h4" color="text.secondary">
            No payment data available
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default observer(PaymentsHistory);
