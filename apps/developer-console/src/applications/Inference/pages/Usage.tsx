import {
  Box,
  Typography,
  Stack,
  Alert,
  Button,
  TextField,
  MenuItem,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  styled,
} from '@cluster-apps/ui';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';

import { useOwnerBuckets } from '~/inference/useInference';
import { nameOf, type GroupTotal, type Peak } from '~/inference/metricsApi';
import {
  useReadKey,
  useLiveLimits,
  useUsageBoards,
  RANGE_OPTIONS,
  USAGE_RANGES,
  type UsageRange,
  type Live,
  type Boards,
} from '~/inference/useUsage';
import { PageHeader, Section, ComingSoon } from '~/components';

/**
 * Inference → Usage, read live from the Inference Gateway (not recon). On open
 * the page mints a short-lived COMPUTE key for the chosen bucket (in memory,
 * never stored) and reads two routes scoped to it: /limits for the live
 * "N of N at once" grid, and /metrics for the range totals — requests and GPU
 * units by model, tokens in/out, refusals by reason. Money (inference on the
 * bill) is deferred to D37 and lives in Billing, not here.
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
  backgroundColor: theme.palette.background.paper,
  padding: theme.spacing(2.5),
}));

const BarTrack = styled(Box)(({ theme }) => ({
  flex: 1,
  height: 8,
  borderRadius: 4,
  backgroundColor: theme.palette.action.hover,
  overflow: 'hidden',
}));

const counts = new Intl.NumberFormat('en-US');
const fmtCount = (v: number) => counts.format(Math.round(v));
/** GPU units are small fractions; keep precision under 1, two decimals above. */
const fmtUnits = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: v !== 0 && Math.abs(v) < 1 ? 6 : 2 });

/** A gateway failure in user words — an expired read vs the gateway being down. */
const friendlyError = (status?: number): string =>
  status === 401 || status === 403
    ? 'Your usage session expired. Click Show usage to read it again.'
    : 'The inference gateway isn’t responding right now. Try Refresh in a moment.';

const RANGE_LABEL: Record<UsageRange, string> = {
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
};

const Muted = ({ children }: { children: React.ReactNode }) => (
  <Typography variant="body2" color="text.secondary">
    {children}
  </Typography>
);

/** The live "right now" grid from /limits: in flight against the limit, per model. */
function LiveGrid({ live }: { live: Live }) {
  if (live.kind === 'loading') return <Muted>Loading…</Muted>;
  if (live.kind === 'error')
    return (
      <Alert severity="error">
        <span title={live.message}>{friendlyError(live.status)}</span>
      </Alert>
    );
  const models = [...live.limits.models].sort((a, b) => (a.alias ?? a.model).localeCompare(b.alias ?? b.model));
  if (models.length === 0) return <Muted>No models available right now.</Muted>;
  return (
    <Stack spacing="12px">
      {models.map((m) => {
        const max = m.limit.maxInFlight;
        return (
          <Stack key={m.model} direction="row" alignItems="center" spacing="12px">
            <Typography variant="body2" sx={{ width: 160, flexShrink: 0 }} noWrap title={m.model}>
              {m.alias ?? nameOf(m.model)}
            </Typography>
            <BarTrack>
              <Box sx={{ width: max > 0 ? `${Math.min(100, (m.inFlight / max) * 100)}%` : '0%', height: '100%', backgroundColor: 'primary.main' }} />
            </BarTrack>
            <Typography variant="body2" sx={{ width: 96, flexShrink: 0, textAlign: 'right' }}>
              {max > 0 ? `${m.inFlight} of ${max}` : String(m.inFlight)}
            </Typography>
          </Stack>
        );
      })}
    </Stack>
  );
}

/** Peak concurrent requests per bucket over the range, against the plan limit. */
function PeakChart({ peaks, limit, range }: { peaks: Peak[]; limit: number; range: UsageRange }) {
  const top = Math.max(limit, 1, ...peaks.map((p) => p.peak));
  const daily = USAGE_RANGES[range].chartBucketMs >= 86_400_000;
  const fmtLabel = (t: number) =>
    new Date(t).toLocaleString('en-US', daily ? { month: 'short', day: 'numeric', timeZone: 'UTC' } : { hour: 'numeric', timeZone: 'UTC' });
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 120 }}>
        {peaks.map((p) => {
          const hit = limit > 0 && p.peak >= limit;
          return (
            <Box
              key={p.t}
              title={`${fmtLabel(p.t)} · peak ${p.peak}${limit > 0 ? ` of ${limit}` : ''}`}
              sx={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', alignItems: 'flex-end' }}
            >
              <Box
                sx={{
                  width: '100%',
                  height: `${Math.max(2, (p.peak / top) * 100)}%`,
                  borderRadius: '3px 3px 0 0',
                  backgroundColor: hit ? 'warning.main' : 'primary.main',
                }}
              />
            </Box>
          );
        })}
      </Box>
      {peaks.length > 0 && (
        <Stack direction="row" justifyContent="space-between" marginTop="6px">
          <Muted>{fmtLabel(peaks[0].t)}</Muted>
          <Muted>{fmtLabel(peaks[peaks.length - 1].t)}</Muted>
        </Stack>
      )}
    </Box>
  );
}

/** One row per model: requests and GPU units over the range. */
function ModelTable({ requests, gpu }: { requests: GroupTotal[]; gpu: GroupTotal[] }) {
  const byModel = new Map<string, { requests: number; gpu: number }>();
  for (const r of requests) byModel.set(r.group, { requests: r.total, gpu: byModel.get(r.group)?.gpu ?? 0 });
  for (const g of gpu) byModel.set(g.group, { requests: byModel.get(g.group)?.requests ?? 0, gpu: g.total });
  const rows = [...byModel.entries()].map(([model, v]) => ({ model, ...v })).sort((a, b) => b.requests - a.requests);
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Model</TableCell>
            <TableCell align="right">Requests</TableCell>
            <TableCell align="right">GPU units</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.model}>
              <TableCell>{nameOf(r.model)}</TableCell>
              <TableCell align="right">{fmtCount(r.requests)}</TableCell>
              <TableCell align="right">{r.gpu > 0 ? fmtUnits(r.gpu) : '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/** The range boards: a refusal banner, totals, the peak chart, and a per-model table. */
function BoardsView({ boards, range }: { boards: Boards; range: UsageRange }) {
  if (boards.kind === 'loading') return <Muted>Loading…</Muted>;
  if (boards.kind === 'unavailable') return <Alert severity="info">Usage history isn’t available on this cluster yet.</Alert>;
  if (boards.kind === 'error')
    return (
      <Alert severity="error">
        <span title={boards.message}>{friendlyError(boards.status)}</span>
      </Alert>
    );

  const d = boards.data;
  const empty = d.totalRequests === 0 && d.peaks.length === 0 && d.totalRefusals === 0;
  if (empty) {
    return (
      <Empty>
        <Typography variant="subtitle1" marginBottom="8px">
          No usage in this range
        </Typography>
        <Muted>Calls you make with an API key will show up here, by model.</Muted>
      </Empty>
    );
  }

  const atLimit = d.refusalsByReason.find((r) => r.group === 'rate_limited')?.total ?? 0;
  const modelFull = d.refusalsByReason.find((r) => r.group === 'saturated')?.total ?? 0;
  const hasModels = d.requestsByModel.length > 0 || d.gpuByModel.length > 0;

  return (
    <Stack spacing="20px">
      {d.totalRefusals > 0 && (
        <Alert severity="warning">
          {fmtCount(d.totalRefusals)} request{d.totalRefusals === 1 ? '' : 's'} refused in this range
          {atLimit + modelFull > 0 && ` — ${fmtCount(atLimit)} at your limit, ${fmtCount(modelFull)} model was full`}.
        </Alert>
      )}

      <Stack direction="row" spacing="16px" flexWrap="wrap" useFlexGap>
        <Tile>
          <Muted>Requests</Muted>
          <Typography variant="h4" marginTop="4px">
            {fmtCount(d.totalRequests)}
          </Typography>
        </Tile>
        <Tile>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Muted>Tokens</Muted>
            <ComingSoon />
          </Stack>
          <Typography variant="body2" color="text.secondary" marginTop="8px">
            Per-model token counts are on the way.
          </Typography>
        </Tile>
      </Stack>

      {d.peaks.length > 0 && (
        <Section title="Requests at once" actions={<Muted>{d.concurrencyLimit > 0 ? `Limit ${d.concurrencyLimit}` : ''}</Muted>}>
          <PeakChart peaks={d.peaks} limit={d.concurrencyLimit} range={range} />
        </Section>
      )}

      {hasModels && (
        <Section title="By model" flush>
          <ModelTable requests={d.requestsByModel} gpu={d.gpuByModel} />
        </Section>
      )}
    </Stack>
  );
}

function Board({ gatewayKey, onExpired }: { gatewayKey: string; onExpired: () => void }) {
  const [range, setRange] = useState<UsageRange>('24h');
  const [reload, setReload] = useState(0);
  const live = useLiveLimits(gatewayKey, onExpired);
  const boards = useUsageBoards(gatewayKey, range, reload, onExpired);

  return (
    <Box>
      <Box marginBottom="20px">
        <PageHeader
          title="Usage"
          actions={
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TextField
                select
                size="small"
                value={range}
                onChange={(e) => setRange(e.target.value as UsageRange)}
                sx={{ minWidth: 150 }}
              >
                {RANGE_OPTIONS.map((r) => (
                  <MenuItem key={r} value={r}>
                    {RANGE_LABEL[r]}
                  </MenuItem>
                ))}
              </TextField>
              <Button size="small" variant="outlined" color="secondary" onClick={() => setReload((n) => n + 1)}>
                Refresh
              </Button>
            </Stack>
          }
        />
      </Box>

      <Stack spacing="20px">
        <Section title="Right now" actions={<Muted>Live · refreshes every 15s</Muted>}>
          <LiveGrid live={live} />
        </Section>

        <BoardsView boards={boards} range={range} />
      </Stack>
    </Box>
  );
}

const Usage = () => {
  const { buckets, loading, error } = useOwnerBuckets();
  // The COMPUTE key is billed to one of the wallet's buckets behind the scenes;
  // the mockup has no bucket to pick, so Usage reads the first (#191 review).
  const active = buckets[0]?.id || '';
  const { state: key, mint, expire } = useReadKey(active || null);

  const header = (actions?: React.ReactNode) => (
    <Box marginBottom="20px">
      <PageHeader title="Usage" actions={actions} />
    </Box>
  );

  if (error) {
    return (
      <Box>
        {header()}
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }
  if (loading && buckets.length === 0) {
    return (
      <Box>
        {header()}
        <Muted>Preparing…</Muted>
      </Box>
    );
  }
  if (buckets.length === 0) {
    return (
      <Box>
        {header()}
        <Alert severity="info" action={<Button component={NavLink} to="/content-storage" size="small">Storage</Button>}>
          You need a storage bucket to meter inference against. Create one first.
        </Alert>
      </Box>
    );
  }

  if (key.kind === 'ready') {
    return (
      <Box>
        <Board key={key.key} gatewayKey={key.key} onExpired={expire} />
      </Box>
    );
  }

  // Idle / minting / error — the page frame stays, the body says where it is.
  // Minting is gated behind an explicit click: it signs, which pops the wallet
  // passkey when the signer is cold, so it shouldn't fire on open.
  return (
    <Box>
      {header()}
      {key.kind === 'minting' ? (
        <Muted>Authorizing…</Muted>
      ) : key.kind === 'error' ? (
        <Stack direction="row" spacing={1} alignItems="center">
          <Muted>Couldn’t authorize usage reads.</Muted>
          <Button size="small" variant="text" onClick={mint}>
            Try again
          </Button>
        </Stack>
      ) : (
        <Stack spacing={1.5} alignItems="flex-start">
          <Muted>Reading your usage needs a wallet signature — once per visit, good for an hour.</Muted>
          <Button variant="contained" onClick={mint}>
            Show usage
          </Button>
        </Stack>
      )}
    </Box>
  );
};

export default observer(Usage);
