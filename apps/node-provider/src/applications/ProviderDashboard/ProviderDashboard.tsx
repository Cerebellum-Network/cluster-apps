import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Typography, CircularProgress, TextField, MenuItem } from '@cluster-apps/ui';
import { useProviderUsageStore } from '~/hooks';
import { EraRangeSelector } from '~/components/ProviderDashboard/EraRangeSelector';
import { UsageChartCard } from '~/components/ProviderDashboard/UsageChartCard';
import { PastErasCard } from '~/components/ProviderDashboard/PastErasCard';
import { EmptyState } from '~/components/ProviderDashboard/EmptyState';
import { ErrorBanner } from '~/components/ProviderDashboard/ErrorBanner';

// TODO: Remove — temporary hardcoded providers for dev/testing
const DEV_PROVIDERS = [
  '0x906e8988ae48ba8f986c14b4555aa93e3e4f06740d108434654413a76c157147',
  '0xde55271048727abbefea548db9db544c10ea42fb2e470166a14fbbbd8438fd29',
  '0x529c5a5afde27b1032042b2e2a6e072bb97b4d73acf7a4fbeaa3b44cdadaab5b',
  '0xd2a616f243395059389b8021849a7d1b361512b409adb88649def0abea6db857',
  '0x1e6cbb4d6962292e5210b8c986ce0d86fe00db6620c58a23b91bc428438b7125',
  '0x2059d5e88183da278042f6a199bb4667350f2c4313d0c1ee63bfe911257b851b',
  '0x0c6ee0865989fabac6e5807a7260c8f2356de11c3f0018c5f5fe334f4ee16938',
  '0x562fae489205c647b1c7e35843dd60100b915505c770dddf1637a980b0c9a802',
  '0xb47f7606236f5a62c39eacaec37e21556db916d4cbcfe001ade967b55fe17c0f',
  '0x60d1214fd82d996ddd035aad3608b409acdfcaabe6acc77b62d14e952846ae4d',
  '0xee6a2eab6e931250bcf925969a6721137e8fa7af65f343c71132af43a3a35a71',
  '0x0283fe39c0c9a0e297040a73429e561e2680f8b65b34cca356f4bfb844fa5445',
];

const ProviderDashboard = () => {
  const store = useProviderUsageStore();
  const [selectedProvider, setSelectedProvider] = useState(DEV_PROVIDERS[0]);

  useEffect(() => {
    store.fetchEras(selectedProvider);
  }, [selectedProvider, store]);

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
          <Typography variant="h3">Provider Dashboard</Typography>
          <Box display="flex" gap={2} alignItems="center">
            <TextField
              select
              size="small"
              label="Provider"
              value={selectedProvider}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedProvider(e.target.value)}
              sx={{ minWidth: 220 }}
            >
              {DEV_PROVIDERS.map((id) => (
                <MenuItem key={id} value={id}>
                  {id.slice(0, 10)}…{id.slice(-6)}
                </MenuItem>
              ))}
            </TextField>
            <EraRangeSelector
              value={store.eraRangePreset}
              onChange={(preset) => store.setEraRange(preset)}
            />
          </Box>
        </Box>

        <Box padding="24px">
          {store.error && (
            <ErrorBanner message={store.error} onRetry={() => store.retry()} />
          )}

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

export default observer(ProviderDashboard);
