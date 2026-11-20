import { useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@cluster-apps/ui';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { NavLink } from 'react-router-dom';

import { PageHeader } from '~/components';
import { useOwnerBuckets } from '~/inference/useInference';
import { DEFAULT_PRESET, USAGE_PRESET_KEYS, type UsagePreset } from '~/inference/usageMath';
import { useUsageData, useUsageKey } from '~/inference/useUsage';
import UsageView from './usage/UsageView';

/**
 * Inference → Usage, read live from the Inference Gateway's /api/v1/metrics
 * and /api/v1/limits with a bucket-scoped token. The token is cached per
 * account and bucket (usageToken.ts); when none is, it is minted as the page
 * opens and the wallet shows its own consent — there is no in-page step.
 */
const Muted = ({ children }: { children: React.ReactNode }) => (
  <Typography variant="body2" color="text.secondary">
    {children}
  </Typography>
);

const Usage = () => {
  const { buckets, loading, error } = useOwnerBuckets();
  // Usage bills to the wallet's first bucket, as the API key panel defaults to.
  const bucketId = buckets[0]?.id || null;
  const { state: key, onAuthError, retry } = useUsageKey(bucketId);
  const [preset, setPreset] = useState<UsagePreset>(DEFAULT_PRESET);
  const [reload, setReload] = useState(0);
  const usage = useUsageData(key.kind === 'ready' ? key.key : null, preset, reload, onAuthError);

  const busy = key.kind === 'minting' || usage.kind === 'loading' || (usage.kind === 'ready' && usage.refreshing);
  const refresh = () => (key.kind === 'error' ? retry() : setReload((n) => n + 1));

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
            >
              {USAGE_PRESET_KEYS.map((p) => (
                <ToggleButton key={p} value={p} sx={{ paddingX: '12px', paddingY: '4px', textTransform: 'none' }}>
                  {p}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Button size="small" variant="outlined" color="secondary" onClick={refresh} disabled={busy && key.kind !== 'error'}>
              Refresh
            </Button>
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
    body = <UsageView data={usage.data} preset={preset} gatewayKey={key.key} onAuthError={onAuthError} />;
  }

  return (
    <Box>
      {header}
      {body}
    </Box>
  );
};

export default observer(Usage);
