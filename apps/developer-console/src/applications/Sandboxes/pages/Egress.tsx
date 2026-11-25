import { useMemo, useState } from 'react';
import { Box, Button, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@cluster-apps/ui';
import { NavLink } from 'react-router-dom';

import { PageHeader, Section } from '~/components';
import { useCompute } from '~/compute/ComputeProvider';
import { useEgressLog, useNow, useSandboxes, useSecrets } from '~/compute/hooks';
import { fmtAgo, shortId } from '~/compute/format';
import { isLive, type EgressDecision } from '~/compute/types';
import { color, mono, text } from '~/theme/tokens';
import EgressTable from '../components/detail/EgressTable';
import { BucketChip, KeyGlyph, ReadError, sbColor } from '../components/ui';
import { Chip } from './SandboxList';

const WINDOWS = [
  { id: '1h', label: 'Last hour', ms: 3600_000 },
  { id: '24h', label: '24 hours', ms: 86_400_000 },
  { id: '7d', label: '7 days', ms: 7 * 86_400_000 },
] as const;

const DECISIONS: { id: EgressDecision | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'allowed', label: 'Allowed' },
  { id: 'denied', label: 'Denied' },
  { id: 'error', label: 'Upstream errors' },
];

/** The bucket's credentials and the hosts each may be sent to (`GET /v1/secrets`), with what running sandboxes name them. */
const Credentials = () => {
  const { data, error } = useSecrets();
  const sandboxes = useSandboxes();
  const now = useNow(10_000);
  const live = (sandboxes.data?.items ?? []).filter((s) => isLive(s.status));
  const usedBy = (name: string) => live.filter((s) => s.egress.allow.some((r) => r.credential === name)).length;
  return (
    <Section
      title="Credentials"
      flush
      actions={
        <Button component={NavLink} to="/sandboxes/secrets" variant="text" color="secondary" size="small">
          Manage in Secrets
        </Button>
      }
    >
      {error && !data ? (
        <Box padding="0 22px 18px">
          <ReadError what="your secrets" error={error} />
        </Box>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Secret</TableCell>
              <TableCell>Added as</TableCell>
              <TableCell>Sent only to</TableCell>
              <TableCell>Named by</TableCell>
              <TableCell>Updated</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(data ?? []).map((s) => {
              const n = usedBy(s.name);
              return (
                <TableRow key={s.name}>
                  <TableCell>
                    <Stack direction="row" alignItems="center" gap="8px" sx={{ color: sbColor.credential }}>
                      <KeyGlyph />
                      <Box component="span" sx={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: color.text }}>
                        {s.name}
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ fontSize: 13 }}>
                    Header{' '}
                    <Box component="span" sx={{ fontFamily: mono, fontSize: 12.5, color: color.textSecondary }}>
                      {s.header}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {s.hosts && s.hosts.length > 0 ? (
                      <Box component="span" sx={{ fontFamily: mono, fontSize: 12.5 }}>
                        {s.hosts.join(', ')}
                      </Box>
                    ) : (
                      <Typography sx={{ ...text.caption, color: color.warning }}>
                        {s.hosts ? 'nowhere: store it again with its hosts' : 'not listed by this gateway'}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ fontSize: 13 }}>
                    {sandboxes.data ? (
                      n ? (
                        `${n} running sandbox${n === 1 ? '' : 'es'}`
                      ) : (
                        <Box component="span" sx={{ color: color.textTertiary }}>
                          no running sandbox
                        </Box>
                      )
                    ) : (
                      '…'
                    )}
                  </TableCell>
                  <TableCell sx={{ fontSize: 13, color: color.textSecondary }} title={s.updated_at}>
                    {fmtAgo(s.updated_at, now)}
                  </TableCell>
                </TableRow>
              );
            })}
            {data && data.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} sx={{ textAlign: 'center', padding: '22px' }}>
                  <Typography sx={text.secondary}>
                    No credentials yet. Add one under <NavLink to="/sandboxes/secrets">Secrets</NavLink>, bound to the
                    hosts it is for.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </Section>
  );
};

/** The allow-lists of the sandboxes running now: what can leave the cluster at this moment. */
const RunningRules = () => {
  const { data, error } = useSandboxes();
  const live = (data?.items ?? []).filter((s) => isLive(s.status));
  return (
    <Section
      title="Running now"
      actions={
        <Button component={NavLink} to="/sandboxes/list?new=1" variant="text" color="secondary" size="small">
          New sandbox
        </Button>
      }
    >
      {error && !data ? (
        <ReadError what="your sandboxes" error={error} />
      ) : !data ? (
        <Typography sx={text.secondary}>Reading…</Typography>
      ) : live.length === 0 ? (
        <Typography sx={text.secondary}>No sandbox is running, so nothing can reach out right now.</Typography>
      ) : (
        <Stack gap="10px" sx={{ maxHeight: 260, overflow: 'auto' }}>
          {live.map((s) => (
            <Box key={s.id}>
              <Box
                component={NavLink}
                to={`/sandboxes/list/${s.id}?tab=egress`}
                sx={{ fontFamily: mono, fontSize: 12.5, fontWeight: 600, color: color.primary, textDecoration: 'none' }}
              >
                {shortId(s.id)}
              </Box>
              {s.labels['cere.agent'] && (
                <Box component="span" sx={{ ...text.caption, marginLeft: '6px' }}>
                  agent {s.labels['cere.agent']}
                </Box>
              )}
              <Typography sx={{ ...text.caption, fontFamily: mono }}>
                {s.egress.allow.length
                  ? s.egress.allow
                      .map((r) => `${r.host}${r.path_prefix ?? ''}${r.credential ? ` +${r.credential}` : ''}`)
                      .join(' · ')
                  : 'no hosts: no network'}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Section>
  );
};

/**
 * Egress: how a sandbox reaches the network, where its rules and credentials
 * are set, and every request the egress proxy saw (`GET /v1/egress/log`, this
 * bucket only). Rules belong to each sandbox (set at create, or by an agent
 * definition); there is no bucket-wide policy in the API.
 */
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
          title="Egress"
          subtitle={
            <>
              Nothing is allowed by default: a sandbox has no network of its own, and the egress proxy refuses every
              host its rules don’t list. Rules are set per sandbox when it is created (
              <NavLink to="/sandboxes/list?new=1">New sandbox</NavLink>, <code>--allow</code> in the CLI), or in an{' '}
              <NavLink to="/agents/definitions">agent definition</NavLink> for each of its runs. Credentials live in{' '}
              <NavLink to="/sandboxes/secrets">Secrets</NavLink>, each bound to the hosts it may be sent to; the proxy
              adds one to the requests a rule allows, so it never enters the sandbox.
            </>
          }
          actions={<BucketChip bucketId={bucketId} />}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.6fr) minmax(300px, 1fr)' },
          gap: '16px',
          alignItems: 'start',
          marginBottom: '24px',
        }}
      >
        <Credentials />
        <RunningRules />
      </Box>

      <Typography component="h2" sx={{ ...text.title, marginBottom: '10px' }}>
        Log
      </Typography>
      <Typography sx={{ ...text.secondary, marginBottom: '12px' }}>
        Every request your sandboxes made through the proxy: allowed, denied, or failed upstream, and the credential it
        added. Query strings and header values are never logged.
      </Typography>
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
        {error && data && (
          <Typography sx={{ ...text.caption, color: color.danger }} title={error}>
            Refresh failed; showing the last read.
          </Typography>
        )}
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
