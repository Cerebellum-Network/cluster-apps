import { useMemo } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@cluster-apps/ui';
import { NavLink } from 'react-router-dom';

import { ComingSoon } from '~/components';
import { DISCORD_LINK } from '~/constants';
import type { UsageData } from '~/inference/useUsage';
import {
  fmtCount,
  gpuWords,
  modelColors,
  OTHER_COLOR,
  PREVIOUS_LABEL,
  stackSeries,
  stepPhrase,
  stepsByModel,
  throttleNotice,
  usageRows,
  usageTiles,
  type UsagePreset,
} from '~/inference/usageMath';
import UsageChart from './UsageChart';
import UsageModelsTable from './UsageModelsTable';
import UsageTiles from './UsageTiles';

/** "N requests were refused at your plan's limit of X at once." with what to do about it. */
export function UpgradeNotice({ refused, limit }: { refused: number; limit: number | null }) {
  return (
    <Alert
      severity="warning"
      action={
        <Stack direction="row" alignItems="center" gap="8px" sx={{ paddingRight: '4px' }}>
          <Button size="small" variant="outlined" disabled endIcon={<ComingSoon />}>
            Upgrade plan
          </Button>
          <Button size="small" variant="text" component="a" href={DISCORD_LINK} target="_blank" rel="noopener noreferrer">
            Talk to us
          </Button>
        </Stack>
      }
    >
      {`${fmtCount(refused)} request${refused === 1 ? ' was' : 's were'} refused at your plan’s limit`}
      {limit !== null ? ` of ${fmtCount(limit)} at once.` : '.'}
    </Alert>
  );
}

/** No usage in the period: what to do next. */
export function EmptyUsage() {
  return (
    <Box sx={{ border: '1px dashed #D5D6E2', borderRadius: '16px', padding: '56px 24px', textAlign: 'center', backgroundColor: '#fff' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, marginBottom: '6px' }}>
        No usage yet
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ marginBottom: '18px' }}>
        Make your first call with an API key and it shows up here, by model, within a minute or two.
      </Typography>
      <Button variant="contained" component={NavLink} to="/inference/quickstart">
        Show me how
      </Button>
    </Box>
  );
}

/** The page body for one window's data: notice, tiles, two charts, the models table. */
const UsageView = ({ data, preset, gatewayKey, onAuthError }: {
  data: UsageData;
  preset: UsagePreset;
  gatewayKey: string;
  onAuthError: () => void;
}) => {
  const view = useMemo(() => {
    const rows = usageRows(data.reads, data.fallbackLimits);
    const colors = modelColors(rows);
    const colorOf = (m: string) => colors.get(m) ?? OTHER_COLOR;
    const w = data.window;
    const gpu = stepsByModel(data.gpuSteps, w);
    const requests = stepsByModel(data.requestSteps, w);
    return {
      rows,
      colorOf,
      tiles: usageTiles(rows),
      notice: throttleNotice(rows),
      gpu: { startsMs: gpu.startsMs, series: stackSeries(gpu.byModel, data.reads.gpu, colorOf, gpu.startsMs.length) },
      requests: { startsMs: requests.startsMs, series: stackSeries(requests.byModel, data.reads.requests, colorOf, requests.startsMs.length) },
    };
  }, [data]);

  if (view.rows.length === 0) return <EmptyUsage />;

  const sub = `per ${stepPhrase(data.window.barMs)}, by model`;
  return (
    <Stack spacing="16px">
      {view.notice && <UpgradeNotice refused={view.notice.refused} limit={view.notice.limit} />}
      <UsageTiles tiles={view.tiles} prevLabel={PREVIOUS_LABEL[preset]} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' }, gap: '16px' }}>
        <UsageChart title="GPU units" sub={sub} startsMs={view.gpu.startsMs} barMs={data.window.barMs} series={view.gpu.series} format={gpuWords} />
        <UsageChart title="Requests" sub={sub} startsMs={view.requests.startsMs} barMs={data.window.barMs} series={view.requests.series} format={fmtCount} />
      </Box>
      <UsageModelsTable
        rows={view.rows}
        colorOf={view.colorOf}
        gatewayKey={gatewayKey}
        window={data.window}
        tokensAvailable={data.tokensAvailable}
        onAuthError={onAuthError}
      />
    </Stack>
  );
};

export default UsageView;
