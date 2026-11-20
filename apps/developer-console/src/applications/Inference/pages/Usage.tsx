import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from '@cluster-apps/ui';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { NavLink } from 'react-router-dom';

import { PageHeader } from '~/components';
import { nameOf } from '~/inference/metricsApi';
import { taskLabel } from '~/inference/model';
import { useModels, useOwnerBuckets } from '~/inference/useInference';
import { DEFAULT_PRESET, USAGE_PRESET_KEYS, type UsagePreset } from '~/inference/usageMath';
import { useUsageData, useUsageKey } from '~/inference/useUsage';
import UsageView from './usage/UsageView';
import { color, CONTROL_HEIGHT, text } from '~/theme/tokens';

/**
 * Inference → Usage, read live from the Inference Gateway's /api/v1/metrics
 * and /api/v1/limits with a bucket-scoped token. The token is cached per
 * account and bucket (usageToken.ts); when none is, it is minted as the page
 * opens and the wallet shows its own consent — there is no in-page step.
 */
const Muted = ({ children }: { children: React.ReactNode }) => (
  <Typography sx={text.secondary}>{children}</Typography>
);

/** Auto-refresh choices, as ROC offers them; 0 is off. */
const AUTO_REFRESH: Array<{ ms: number; label: string }> = [
  { ms: 0, label: 'Off' },
  { ms: 30_000, label: '30s' },
  { ms: 60_000, label: '1m' },
  { ms: 300_000, label: '5m' },
];
const DEFAULT_AUTO_REFRESH_MS = 60_000;

/** Bumps the returned counter every `ms` while the tab is visible; 0 never does. */
function useAutoRefresh(ms: number, onTick: () => void) {
  useEffect(() => {
    if (ms <= 0) return undefined;
    const id = setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) onTick();
    }, ms);
    return () => clearInterval(id);
  }, [ms, onTick]);
}

const Usage = () => {
  const { buckets, loading, error } = useOwnerBuckets();
  // Usage bills to the wallet's first bucket, as the API key panel defaults to.
  const bucketId = buckets[0]?.id || null;
  const { state: key, onAuthError, retry } = useUsageKey(bucketId);
  const [preset, setPreset] = useState<UsagePreset>(DEFAULT_PRESET);
  const [reload, setReload] = useState(0);
  const [autoMs, setAutoMs] = useState(DEFAULT_AUTO_REFRESH_MS);
  const usage = useUsageData(key.kind === 'ready' ? key.key : null, preset, reload, onAuthError);
  const bump = useCallback(() => setReload((n) => n + 1), []);
  useAutoRefresh(key.kind === 'ready' ? autoMs : 0, bump);

  // A model's kind for the Kind filter, from the catalogue's model.json `task`.
  const { cards } = useModels();
  const kindOf = useMemo(() => {
    const kinds = new Map<string, string>();
    for (const c of cards) {
      const kind = taskLabel(c.task);
      kinds.set(c.name, kind);
      kinds.set(nameOf(c.id), kind);
    }
    return (model: string) => kinds.get(model) ?? 'Other';
  }, [cards]);

  const busy = key.kind === 'minting' || usage.kind === 'loading' || (usage.kind === 'ready' && usage.refreshing);
  const refresh = () => (key.kind === 'error' ? retry() : bump());

  const header = (
    <Box marginBottom="20px">
      <PageHeader
        title="Usage"
        actions={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ToggleButtonGroup
              size="small"
              exclusive
              value={preset}
              onChange={(_, v: UsagePreset | null) => v && setPreset(v)}
              aria-label="Period"
              sx={{ height: CONTROL_HEIGHT, backgroundColor: color.surface }}
            >
              {USAGE_PRESET_KEYS.map((p) => (
                <ToggleButton
                  key={p}
                  value={p}
                  sx={{
                    paddingX: '12px',
                    textTransform: 'none',
                    fontSize: 13,
                    fontWeight: 600,
                    color: color.textSecondary,
                    borderColor: color.border,
                    '&.Mui-selected, &.Mui-selected:hover': { color: color.primaryDark, backgroundColor: color.primaryTint },
                  }}
                >
                  {p}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Button
              size="small"
              variant="outlined"
              color="secondary"
              onClick={refresh}
              disabled={busy && key.kind !== 'error'}
              sx={{ height: CONTROL_HEIGHT, backgroundColor: color.surface, borderColor: color.border }}
            >
              Refresh
            </Button>
            <TextField
              select
              size="small"
              value={String(autoMs)}
              onChange={(e) => setAutoMs(Number(e.target.value))}
              aria-label="Auto-refresh"
              sx={{
                minWidth: 112,
                '& .MuiInputBase-root': { height: CONTROL_HEIGHT, fontSize: 13, fontWeight: 600, backgroundColor: color.surface },
                '& .MuiSelect-select': { paddingTop: 0, paddingBottom: 0 },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: color.border },
              }}
              InputProps={{ startAdornment: <Typography sx={{ ...text.secondary, marginRight: '6px', whiteSpace: 'nowrap' }}>Auto</Typography> }}
            >
              {AUTO_REFRESH.map((o) => (
                <MenuItem key={o.ms} value={String(o.ms)} sx={{ fontSize: 14 }}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        }
      />
    </Box>
  );

  let body: React.ReactNode;
  if (error) {
    body = <Alert severity="error">{error}</Alert>;
  } else if (!bucketId) {
    body = loading || buckets.length > 0 ? (
      <Muted>Loading…</Muted>
    ) : (
      <Alert severity="info" action={<Button component={NavLink} to="/content-storage" size="small">Storage</Button>}>
        You need a storage bucket to meter inference against. Create one first.
      </Alert>
    );
  } else if (key.kind === 'error') {
    body = (
      <Alert severity="error">
        <span title={key.detail}>{key.message}</span>
      </Alert>
    );
  } else if (key.kind === 'minting') {
    body = <Muted>Waiting for your wallet…</Muted>;
  } else if (usage.kind === 'loading') {
    body = <Muted>Loading…</Muted>;
  } else if (usage.kind === 'unavailable') {
    body = <Alert severity="info">Usage history isn’t available on this cluster yet.</Alert>;
  } else if (usage.kind === 'error') {
    body = (
      <Alert severity="error">
        <span title={usage.detail}>{usage.message}</span>
      </Alert>
    );
  } else {
    body = <UsageView data={usage.data} preset={preset} gatewayKey={key.key} onAuthError={onAuthError} kindOf={kindOf} />;
  }

  return (
    <Box>
      {header}
      {body}
    </Box>
  );
};

export default observer(Usage);
