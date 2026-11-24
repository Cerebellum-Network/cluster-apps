import { useMemo, useState } from 'react';
import { Box, Stack, Typography } from '@cluster-apps/ui';

import { PageHeader, Section } from '~/components';
import { useCompute } from '~/compute/ComputeProvider';
import { useEgressLog } from '~/compute/hooks';
import type { EgressDecision } from '~/compute/types';
import { color, text } from '~/theme/tokens';
import EgressTable from '../components/detail/EgressTable';
import { BucketChip, ReadError } from '../components/ui';
import { Chip } from './SandboxList';

const WINDOWS = [
  { id: '1h', label: 'Last hour', ms: 3600_000 },
  { id: '24h', label: '24 hours', ms: 86_400_000 },
  { id: '7d', label: '7 days', ms: 7 * 86_400_000 },
] as const;

const DECISIONS: { id: EgressDecision | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'allowed', label: 'Allowed' },
  { id: 'denied', label: 'Refused' },
  { id: 'error', label: 'Upstream errors' },
];

/** Every request your sandboxes made through the egress proxy (`GET /v1/egress/log`, this bucket only). */
const Egress = () => {
  const { bucketId } = useCompute();
  const [win, setWin] = useState<(typeof WINDOWS)[number]['id']>('24h');
  const [decision, setDecision] = useState<EgressDecision | 'all'>('all');
  // Fixed when the window is picked, so polls keep the same query and new entries arrive on top.
  const since = useMemo(() => new Date(Date.now() - WINDOWS.find((w) => w.id === win)!.ms).toISOString(), [win]);
  const { data, error } = useEgressLog({ since, decision: decision === 'all' ? undefined : decision });
  const entries = data?.items ?? [];

  return (
    <Box>
      <Box marginBottom="20px">
        <PageHeader
          title="Egress log"
          subtitle="A sandbox has no network of its own. Each request goes through the egress proxy, which checks it against the sandbox’s rules, adds the secret the rule names, and logs it here. Query strings and header values are never logged."
          actions={<BucketChip bucketId={bucketId} />}
        />
      </Box>
      <Stack direction="row" gap="8px" marginBottom="14px" alignItems="center" flexWrap="wrap">
        {DECISIONS.map((d) => (
          <Chip key={d.id} active={decision === d.id} onClick={() => setDecision(d.id)}>
            {d.label}
          </Chip>
        ))}
        <Box width="16px" />
        {WINDOWS.map((w) => (
          <Chip key={w.id} active={win === w.id} onClick={() => setWin(w.id)}>
            {w.label}
          </Chip>
        ))}
        <Box flex={1} />
        {error && data && <Typography sx={{ ...text.caption, color: color.danger }} title={error}>Refresh failed; showing the last read.</Typography>}
        {data && (
          <Typography sx={text.caption}>
            {entries.length}
            {data.truncated ? '+' : ''} requests
          </Typography>
        )}
      </Stack>
      <Section flush>
        <Box padding="0">
          {error && !data ? (
            <Box padding="18px 22px">
              <ReadError what="the egress log" error={error} />
            </Box>
          ) : (
            <EgressTable entries={entries} showSandbox empty={data ? 'No requests in this window.' : 'Reading…'} />
          )}
        </Box>
      </Section>
    </Box>
  );
};

export default Egress;
