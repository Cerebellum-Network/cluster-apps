import {
  Box,
  Typography,
  Stack,
  Alert,
  Button,
  ButtonGroup,
  TextField,
  MenuItem,
  styled,
} from '@cluster-apps/ui';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';

import { useOwnerBuckets } from '~/inference/useInference';
import { nameOf, type GroupTotal } from '~/inference/metricsApi';
import {
  useReadKey,
  useLiveLimits,
  useUsageBoards,
  RANGE_OPTIONS,
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
  backgroundColor: '#fff',
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
const REASONS: Record<string, string> = { rate_limited: 'Rate limited', saturated: 'Saturated' };
const prettyReason = (r: string) => REASONS[r] ?? r;

const Muted = ({ children }: { children: React.ReactNode }) => (
  <Typography variant="body2" color="text.secondary">
    {children}
  </Typography>
);

/** A labelled horizontal bar list, each bar relative to the largest value. */
function Bars({ rows, format, label }: { rows: GroupTotal[]; format: (v: number) => string; label: (g: string) => string }) {
  const max = Math.max(0, ...rows.map((r) => r.total));
  return (
    <Stack spacing="12px">
      {rows.map((r) => (
        <Stack key={r.group} direction="row" alignItems="center" spacing="12px">
          <Typography variant="body2" sx={{ width: 160, flexShrink: 0 }} noWrap title={label(r.group)}>
            {label(r.group)}
          </Typography>
          <BarTrack>
            <Box sx={{ width: max > 0 ? `${Math.max(1.5, (r.total / max) * 100)}%` : '0%', height: '100%', backgroundColor: 'primary.main' }} />
          </BarTrack>
          <Typography variant="body2" sx={{ width: 96, flexShrink: 0, textAlign: 'right' }}>
            {format(r.total)}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

/** The live "right now" grid from /limits: in flight against the limit, per model. */
function LiveGrid({ live }: { live: Live }) {
  if (live.kind === 'loading') return <Muted>Loading…</Muted>;
  if (live.kind === 'error') return <Alert severity="error">{live.message}</Alert>;
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

/** The range boards: requests/GPU by model, tokens in/out, refusals by reason. */
function BoardsView({ boards }: { boards: Boards }) {
  if (boards.kind === 'loading') return <Muted>Loading…</Muted>;
  if (boards.kind === 'unavailable') return <Alert severity="info">Usage history isn’t available on this cluster yet.</Alert>;
  if (boards.kind === 'error') return <Alert severity="error">{boards.message}</Alert>;

  const d = boards.data;
  const empty = d.totalRequests === 0 && d.gpuByModel.length === 0;
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

  return (
    <Stack spacing="20px">
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
            Per-token usage lands with the gateway usage journal.
          </Typography>
        </Tile>
      </Stack>

      {d.requestsByModel.length > 0 && (
        <Section title="Requests by model">
          <Bars rows={d.requestsByModel} format={fmtCount} label={nameOf} />
        </Section>
      )}

      {d.gpuByModel.length > 0 && (
        <Section title="GPU units by model">
          <Bars rows={d.gpuByModel} format={fmtUnits} label={nameOf} />
        </Section>
      )}

      <Section title="Refusals">
        {d.refusalsByReason.length > 0 ? (
          <Bars rows={d.refusalsByReason} format={fmtCount} label={prettyReason} />
        ) : (
          <Muted>No refusals in this range.</Muted>
        )}
      </Section>
    </Stack>
  );
}

function Board({ gatewayKey }: { gatewayKey: string }) {
  const [range, setRange] = useState<UsageRange>('24h');
  const [reload, setReload] = useState(0);
  const live = useLiveLimits(gatewayKey);
  const boards = useUsageBoards(gatewayKey, range, reload);

  return (
    <Box>
      <Box marginBottom="20px">
        <PageHeader
          title="Usage"
          actions={
            <Stack direction="row" spacing={1.5} alignItems="center">
              <ButtonGroup size="small" variant="outlined" color="secondary">
                {RANGE_OPTIONS.map((r) => (
                  <Button
                    key={r}
                    onClick={() => setRange(r)}
                    variant={r === range ? 'contained' : 'outlined'}
                    sx={{ textTransform: 'none' }}
                  >
                    {r}
                  </Button>
                ))}
              </ButtonGroup>
              <Button size="small" variant="outlined" color="secondary" onClick={() => setReload((n) => n + 1)}>
                Refresh
              </Button>
            </Stack>
          }
        />
      </Box>

      <Stack spacing="20px">
        <Section
          title="Right now"
          actions={<Muted>{live.kind === 'ready' ? `${live.limits.profile} profile` : ''}</Muted>}
        >
          <LiveGrid live={live} />
        </Section>

        <BoardsView boards={boards} />
      </Stack>
    </Box>
  );
}

const Usage = () => {
  const { buckets, loading, error } = useOwnerBuckets();
  const [bucketId, setBucketId] = useState<string>('');
  // Default to the first bucket once they load; honour a pick after that.
  const active = bucketId || buckets[0]?.id || '';
  const { state: key, retry } = useReadKey(active || null);

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

  const bucketPicker =
    buckets.length > 1 ? (
      <TextField
        select
        size="small"
        label="Bucket"
        value={active}
        onChange={(e) => setBucketId(e.target.value)}
        sx={{ minWidth: 160 }}
      >
        {buckets.map((b) => (
          <MenuItem key={b.id} value={b.id}>
            {b.id}
          </MenuItem>
        ))}
      </TextField>
    ) : undefined;

  if (key.kind === 'ready') {
    return (
      <Box>
        {bucketPicker && <Box marginBottom="12px">{bucketPicker}</Box>}
        <Board key={key.key} gatewayKey={key.key} />
      </Box>
    );
  }

  // Minting / idle / error — the page frame stays, the body says where it is.
  return (
    <Box>
      {header(bucketPicker)}
      {key.kind === 'error' ? (
        <Stack direction="row" spacing={1} alignItems="center">
          <Muted>Couldn’t authorize usage reads for this bucket.</Muted>
          <Button size="small" variant="text" onClick={retry}>
            Try again
          </Button>
        </Stack>
      ) : (
        <Muted>Authorizing…</Muted>
      )}
    </Box>
  );
};

export default observer(Usage);
