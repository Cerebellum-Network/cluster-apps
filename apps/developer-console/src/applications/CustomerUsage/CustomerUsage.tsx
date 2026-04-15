import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Typography, CircularProgress, TextField, MenuItem } from '@cluster-apps/ui';
import { useCustomerUsageStore } from '~/hooks';
import { EmptyState } from '~/components/CustomerUsage/EmptyState';
import { ErrorBanner } from '~/components/CustomerUsage/ErrorBanner';
import { UsageChartCard } from '~/components/CustomerUsage/UsageChartCard';
import { PastErasCard } from '~/components/CustomerUsage/PastErasCard';
import { EraRangeSelector } from '~/components/CustomerUsage/EraRangeSelector';

// TODO: Remove — temporary hardcoded customers for dev/testing
const DEV_CUSTOMERS = [
  '0xc616043ebf6a10aae04250c77c81be62924757628aaaf8fb1782910a429fc735',
  '0xc069ec6b1556a5ab929788fee7c77b1367169ce02dbbcb8b71a934431cf3d85c',
  '0x0b02bd78da68b42f4907463e20a9d34c50e8cc024fd341e4575b8bff95805289',
  '0x0219d36b74d3aad99d38ad347309192941e1283c2b40ba47df075d7eb32069c6',
  '0x4e6e6605ca6fece1643a97405a69ec73b8d1630771e1e1dbed92972598391bc1',
];

const CustomerUsage = () => {
  const store = useCustomerUsageStore();
  const [selectedCustomer, setSelectedCustomer] = useState(DEV_CUSTOMERS[0]);

  useEffect(() => {
    store.fetchEras(selectedCustomer);
  }, [selectedCustomer, store]);

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Box
        display="flex"
        flexDirection="column"
        border={(theme) => `1px solid ${theme.palette.divider}`}
        borderRadius="12px"
      >
        <Box
          padding="34px 32px"
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          borderBottom={(theme) => `1px solid ${theme.palette.divider}`}
        >
          <Typography variant="h3">Customer Usage</Typography>
          <TextField
            select
            size="small"
            label="Customer"
            value={selectedCustomer}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedCustomer(e.target.value)}
            sx={{ minWidth: 280 }}
          >
            {DEV_CUSTOMERS.map((id) => (
              <MenuItem key={id} value={id}>
                {id.slice(0, 10)}…{id.slice(-6)}
              </MenuItem>
            ))}
          </TextField>
          <EraRangeSelector value={store.eraRangePreset} onChange={(preset) => store.setEraRange(preset)} />
        </Box>

        <Box padding="24px">
          {store.error && <ErrorBanner message={store.error} onRetry={() => store.retry()} />}

          {store.isLoading && (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
              <CircularProgress />
            </Box>
          )}

          {store.isEmpty && <EmptyState />}

          {!store.isLoading && !store.isEmpty && !store.error && (
            <>
              <UsageChartCard
                data={store.chartData}
                selectedMetric={store.selectedMetric}
                onMetricChange={(key) => store.setMetric(key)}
              />

              <PastErasCard data={store.tableData} />
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default observer(CustomerUsage);
