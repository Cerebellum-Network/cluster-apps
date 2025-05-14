import { observer } from 'mobx-react-lite';
import { toJS } from 'mobx';
import { FC, useEffect } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@cluster-apps/ui';
import { FilterSection, SummaryCards, CostTrendsChart, UsageByBucket, PaymentsTable } from './components';
import { usePaymentHistoryStore } from '~/hooks';

const PaymentsHistory: FC = () => {
  const store = usePaymentHistoryStore();

  useEffect(() => {
    // Initial data fetch is handled in the store constructor
    return () => {
      // Cleanup if needed
    };
  }, []);

  // Get filtered data based on selected filters
  const filteredData = toJS(store.getFilteredEraData());
  // Get all era data for the table (unfiltered)
  const allEraData = toJS(store.eraData);

  console.log('PaymentsHistory - Rendering with selected Era:', store.selectedEraId);
  console.log('PaymentsHistory - Filtered data count:', filteredData.length);
  console.log('PaymentsHistory - All era data count:', allEraData.length);

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

      {!store.isLoading && !store.error && allEraData.length > 0 && (
        <>
          {/* Always show cards and charts, even with empty filtered data */}
          <SummaryCards data={filteredData} />

          <Box display="flex" gap={3} sx={{ mb: 4 }}>
            <Box flex={1}>
              <CostTrendsChart data={filteredData} />
            </Box>
            <Box flex={1}>
              <UsageByBucket data={filteredData} />
            </Box>
          </Box>

          {/* Always show the full payment history table */}
          <PaymentsTable data={allEraData} />
        </>
      )}

      {!store.isLoading && !store.error && allEraData.length === 0 && (
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
