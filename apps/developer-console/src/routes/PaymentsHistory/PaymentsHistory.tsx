import { observer } from 'mobx-react-lite';
import { toJS } from 'mobx';
import { FC, useEffect } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@cluster-apps/ui';
import { FilterSection, SummaryCards, CostTrendsChart, UsageByBucket, PaymentsTable } from './components';
import { usePaymentHistoryStore, useAccountStore } from '~/hooks';

const PaymentsHistory: FC = () => {
  const store = usePaymentHistoryStore();
  const account = useAccountStore();

  useEffect(() => {
    if (account.address) {
      store.initialize();
    } else {
      store.reset();
    }
  }, [account.address, store]);

  // Get filtered data based on selected filters
  const filteredData = toJS(store.getFilteredEraData());

  // Get current era data (first item if available)
  const currentEraData = filteredData.length > 0 ? filteredData[0] : null;

  // Log for debugging
  console.log('PaymentsHistory - Rendering with selected Era:', store.selectedEraId);
  console.log('PaymentsHistory - Selected buckets:', store.selectedBucketIds);
  console.log('PaymentsHistory - Filtered eras count:', store.filteredEras.length);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h3" sx={{ mb: 4 }}>
        Payments analytics
      </Typography>

      {store.isInitializing && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!store.isInitializing && store.error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {store.error}
        </Alert>
      )}

      {!store.isInitializing && !store.error && (
        <>
          <FilterSection store={store} />

          {store.isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {!store.isLoading && currentEraData ? (
            <>
              <SummaryCards data={filteredData} />
              <Box display="flex" gap={3} sx={{ mb: 4 }}>
                <Box flex={1}>
                  <CostTrendsChart data={filteredData} />
                </Box>
                <Box flex={1}>
                  <UsageByBucket data={filteredData} />
                </Box>
              </Box>
              <PaymentsTable data={filteredData} />
            </>
          ) : (
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
                {store.selectedBucketIds.length > 0
                  ? 'No payment data available for selected bucket(s)'
                  : 'Please select at least one bucket'}
              </Typography>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default observer(PaymentsHistory);
