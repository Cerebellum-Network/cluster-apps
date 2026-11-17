import { Box, Typography, Stack, Alert, styled } from '@cluster-apps/ui';

import { useBills } from '~/billing/useBilling';
import { inferenceUsage } from '~/billing/model';

/**
 * Inference → Usage (mockup: "a month later"). B-lite: the developer-scope feed
 * that actually exists today — compute (inference) spend and the GPU/CPU/RAM units
 * from recon's bills, per month. The mockup's per-model breakdown, requests-vs-plan
 * and refusals-by-cause need per-agent (orchestrator) or the deferred plan/limits
 * service, so they are called out as "with plans" rather than faked.
 */
const Empty = styled(Box)(({ theme }) => ({
  border: `1px dashed ${theme.palette.divider}`,
  borderRadius: 12,
  padding: theme.spacing(8, 4),
  textAlign: 'center',
}));

const Tile = styled(Box)(({ theme }) => ({
  flex: 1,
  minWidth: 160,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  backgroundColor: '#fff',
  padding: theme.spacing(2.5),
}));

const Card = styled(Box)(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  backgroundColor: '#fff',
  padding: theme.spacing(3),
}));

const BarTrack = styled(Box)(({ theme }) => ({
  flex: 1,
  height: 8,
  borderRadius: 4,
  backgroundColor: theme.palette.action.hover,
  overflow: 'hidden',
}));

const Usage = () => {
  const bills = useBills();
  const usage = inferenceUsage(bills.data);

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" marginBottom="20px">
        <Typography variant="h3">Usage</Typography>
        {usage?.hasData && (
          <Typography variant="body2" color="text.secondary">
            {usage.note}
          </Typography>
        )}
      </Stack>

      {bills.error ? (
        <Alert severity="error">{bills.error}</Alert>
      ) : bills.loading && !bills.data ? (
        <Typography variant="body2" color="text.secondary">
          Loading…
        </Typography>
      ) : !usage || !usage.hasData ? (
        <Empty>
          <Typography variant="subtitle1" marginBottom="8px">
            No usage to show yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460, marginX: 'auto' }}>
            Your inference spend and the compute it used will appear here once you start calling models.
          </Typography>
        </Empty>
      ) : (
        <Stack spacing="20px">
          {/* Headline tiles — the figures recon actually reports at developer scope */}
          <Stack direction="row" spacing="16px" flexWrap="wrap" useFlexGap>
            <Tile>
              <Typography variant="body2" color="text.secondary">
                Compute spend
              </Typography>
              <Typography variant="h4" marginTop="4px">
                {usage.computeSpend}
              </Typography>
            </Tile>
            <Tile>
              <Typography variant="body2" color="text.secondary">
                GPU units
              </Typography>
              <Typography variant="h4" marginTop="4px">
                {usage.gpuUnits}
              </Typography>
            </Tile>
            <Tile>
              <Typography variant="body2" color="text.secondary">
                CPU units
              </Typography>
              <Typography variant="h4" marginTop="4px">
                {usage.cpuUnits}
              </Typography>
            </Tile>
          </Stack>

          {/* Compute spend per month */}
          <Card>
            <Typography variant="subtitle1" marginBottom="16px">
              Compute spend by month
            </Typography>
            <Stack spacing="12px">
              {usage.monthly.map((m) => (
                <Stack key={m.month} direction="row" alignItems="center" spacing="12px">
                  <Typography variant="body2" sx={{ width: 96, flexShrink: 0 }} color="text.secondary">
                    {m.month}
                  </Typography>
                  <BarTrack>
                    <Box sx={{ width: m.width, height: '100%', backgroundColor: 'primary.main' }} />
                  </BarTrack>
                  <Typography variant="body2" sx={{ width: 88, flexShrink: 0, textAlign: 'right' }}>
                    {m.computeUsd}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Card>

          {/* Honest note on what needs plans / per-agent data */}
          <Alert severity="info">
            Per-model breakdown, requests against your plan limit, and refusals by cause appear once plans ship.
          </Alert>
        </Stack>
      )}
    </Box>
  );
};

export default Usage;
