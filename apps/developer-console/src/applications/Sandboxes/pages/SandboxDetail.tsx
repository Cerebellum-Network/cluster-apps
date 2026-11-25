import { useEffect, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Stack, Typography } from '@cluster-apps/ui';
import { NavLink, useParams, useSearchParams } from 'react-router-dom';

import { Pill, Section } from '~/components';
import { AGENT_RUN_KIND, LABEL } from '~/compute/agentRun';
import { POLL, useEgressLog, useNow, useSandbox, useUsageRecords } from '~/compute/hooks';
import { recordSumsLine } from '~/compute/billing';
import { fmtAgo, fmtCpu, fmtDateTime, fmtMib, sumRecords } from '~/compute/format';
import { isLive, type Sandbox } from '~/compute/types';
import { color, mono, text } from '~/theme/tokens';
import { Count, Tabs } from '../components/bits';
import { quoteArg } from '../components/commandLine';
import ExecPanel from '../components/detail/ExecPanel';
import FilesPanel from '../components/detail/FilesPanel';
import LogsPanel from '../components/detail/LogsPanel';
import RecordsTable from '../components/detail/RecordsTable';
import TerminateDialog from '../components/detail/TerminateDialog';
import SandboxEgress from '../components/egress/SandboxEgress';
import UsageMeter from '../components/detail/UsageMeter';
import { CredentialChip, ExitReason, Field, Mono, ReadError, SandboxStatusLabel } from '../components/ui';

type Tab = 'logs' | 'exec' | 'files' | 'egress' | 'usage';
const TABS: Tab[] = ['logs', 'exec', 'files', 'egress', 'usage'];

/** CPU utilisation between two readings of the live usage, 0..1. */
function useCpuHistory(sb: Sandbox | undefined): number[] {
  const prev = useRef<{ id: string; wall: number; cpu: number } | null>(null);
  const [hist, setHist] = useState<number[]>([]);
  useEffect(() => {
    if (!sb) return;
    const p = prev.current;
    const cur = { id: sb.id, wall: sb.usage.wall_s, cpu: sb.usage.cpu_s };
    if (p && p.id === cur.id && cur.wall > p.wall && sb.resources.cpu > 0) {
      const u = (cur.cpu - p.cpu) / ((cur.wall - p.wall) * sb.resources.cpu);
      setHist((h) => [...h.slice(-59), Math.max(0, Math.min(1, u))]);
    }
    prev.current = cur;
  }, [sb]);
  return hist;
}

const Details = ({ sb }: { sb: Sandbox }) => {
  const now = useNow(5000);
  return (
    <Section title="Details">
      <Field label="Node">
        <Mono title={sb.node}>{sb.node ? `${sb.node.slice(0, 16)}…` : 'not placed'}</Mono>
      </Field>
      <Field label="Runtime">
        <Pill>{sb.runtime}</Pill>
      </Field>
      <Field label="Image">
        <Mono>{sb.image}</Mono>
      </Field>
      <Field label="Command">
        <Mono>{sb.command.map(quoteArg).join(' ')}</Mono>
      </Field>
      <Field label="Workdir">
        <Mono>{sb.workdir}</Mono>
      </Field>
      <Field label="Resources">
        {fmtCpu(sb.resources.cpu)}, {fmtMib(sb.resources.memory_mib)}
        {sb.resources.pids ? `, ${sb.resources.pids} pids` : ''}
      </Field>
      <Field label="Stops after">
        {sb.timeout_s >= 3600 ? `${+(sb.timeout_s / 3600).toFixed(1)} h` : `${Math.round(sb.timeout_s / 60)} min`}
        {sb.idle_timeout_s ? `, or ${Math.round(sb.idle_timeout_s / 60)} min idle` : ''}
      </Field>
      <Field label="Created">
        <span title={fmtDateTime(sb.created_at)}>{fmtAgo(sb.created_at, now)}</span>
      </Field>
      {sb.startup_ms != null && <Field label="Started in">{(sb.startup_ms / 1000).toFixed(2)} s</Field>}
      {sb.ended_at && (
        <Field label="Ended">
          <span title={fmtDateTime(sb.ended_at)}>{fmtAgo(sb.ended_at, now)}</span>
        </Field>
      )}
      {sb.exit_reason && (
        <Field label="Exit reason">
          <ExitReason reason={sb.exit_reason} />
        </Field>
      )}
      {sb.exit_code != null && <Field label="Exit code">{sb.exit_code}</Field>}
      {sb.env_keys.length > 0 && (
        <Field label="Environment">
          <Mono>{sb.env_keys.join(', ')}</Mono>
        </Field>
      )}
      {Object.keys(sb.labels).length > 0 && (
        <Field label="Labels">
          <Stack direction="row" gap="4px" flexWrap="wrap" justifyContent="flex-end">
            {Object.entries(sb.labels).map(([k, v]) => (
              <Pill key={k}>
                {k}={v}
              </Pill>
            ))}
          </Stack>
        </Field>
      )}
    </Section>
  );
};

/** The side panel's summary of the allow-list; the Egress tab edits it. */
const EgressRules = ({ sb, onOpen }: { sb: Sandbox; onOpen: () => void }) => (
  <Section
    title="Network access"
    actions={
      <Button size="small" variant="text" color="secondary" onClick={onOpen}>
        {isLive(sb.status) ? 'Change' : 'Log'}
      </Button>
    }
  >
    <Typography sx={{ ...text.secondary, marginBottom: '10px' }}>
      The egress proxy allows only these. Everything else is refused and logged.
    </Typography>
    {sb.egress.allow.length ? (
      <Stack spacing="8px">
        {sb.egress.allow.map((r, i) => (
          <Stack key={`${r.host}-${i}`} direction="row" alignItems="center" justifyContent="space-between" gap="8px">
            <Box minWidth={0}>
              <Box component="span" sx={{ fontFamily: mono, fontSize: 12.5, fontWeight: 600 }}>
                {r.host}
                {r.path_prefix ?? ''}
              </Box>
              <Box component="span" sx={{ ...text.caption, marginLeft: '6px' }}>
                {r.methods.join(', ')}
              </Box>
            </Box>
            <CredentialChip name={r.credential ?? null} />
          </Stack>
        ))}
      </Stack>
    ) : (
      <Typography sx={text.secondary}>No hosts allowed: no network access.</Typography>
    )}
  </Section>
);

/** Shown on a sandbox an agent run used: which agent, which run. */
const AgentBanner = ({ sb }: { sb: Sandbox }) => {
  if (sb.labels[LABEL.kind] !== AGENT_RUN_KIND) return null;
  const run = sb.labels[LABEL.run];
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      gap="12px"
      flexWrap="wrap"
      sx={{
        marginBottom: '16px',
        padding: '12px 18px',
        borderRadius: '12px',
        border: `1px solid ${color.primary}`,
        backgroundColor: color.primaryTint,
      }}
    >
      <Typography sx={{ fontSize: 14 }}>
        An agent run: <strong>{sb.labels[LABEL.agent] ?? 'unnamed'}</strong> (
        {sb.labels[LABEL.harness] ?? 'unknown harness'})
        {run && (
          <>
            , run <Mono>{run}</Mono>
          </>
        )}
        .{' '}
        <Box component="span" sx={text.secondary}>
          Its network rules, logs and usage are this sandbox’s.
        </Box>
      </Typography>
      {run && (
        <Button component={NavLink} to={`/agents/runs/${run}`} size="small" variant="contained">
          Open the run
        </Button>
      )}
    </Stack>
  );
};

const SandboxDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { data: polledData, error, loading, at, reload } = useSandbox(id);
  const [terminated, setTerminated] = useState<Sandbox | null>(null);
  // A rule change answers with the sandbox as it is now: show that until the next poll catches up.
  const [changed, setChanged] = useState<{ sb: Sandbox; at: number } | null>(null);
  const polled = changed && (at ?? 0) < changed.at ? changed.sb : polledData;
  const sb = terminated && polled && terminated.id === polled.id && isLive(polled.status) ? terminated : polled;
  const egress = useEgressLog({ sandbox_id: id });
  // Once the sandbox has ended, its final record follows within seconds: read
  // every few seconds until it is in, then at the usual pace.
  const [awaitFinal, setAwaitFinal] = useState(false);
  const records = useUsageRecords({ sandbox_id: id }, undefined, awaitFinal ? POLL.detail : POLL.records);
  const ended = !!sb && !isLive(sb.status);
  const hasFinal = (records.data?.items ?? []).some((r) => r.final);
  const reloadRecords = records.reload;
  useEffect(() => {
    setAwaitFinal(ended && !hasFinal);
    if (ended && !hasFinal) reloadRecords();
  }, [ended, hasFinal, reloadRecords]);
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab') as Tab | null;
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : 'logs';
  const setTab = (t: Tab) => {
    params.set('tab', t);
    setParams(params, { replace: true });
  };
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [filesKey, setFilesKey] = useState(0);
  const cpuHistory = useCpuHistory(sb);

  if (!sb) {
    return (
      <Box padding="40px" display="flex" justifyContent="center">
        {loading ? <CircularProgress size={24} /> : <ReadError what={`sandbox ${id}`} error={error ?? 'not found'} />}
      </Box>
    );
  }

  const live = isLive(sb.status);
  const entries = (egress.data?.items ?? []).filter((e) => e.decision !== 'policy');
  const refused = entries.filter((e) => e.decision === 'denied').length;
  const recs = [...(records.data?.items ?? [])].sort((a, b) => Date.parse(b.period_end) - Date.parse(a.period_end));
  const totals = sumRecords(recs);

  return (
    <Box>
      <Box sx={{ marginBottom: '6px' }}>
        <Box
          component={NavLink}
          to="/sandboxes/list"
          sx={{ ...text.secondary, textDecoration: 'none', '&:hover': { color: color.primary } }}
        >
          Sandboxes
        </Box>
      </Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={2}
        marginBottom="16px"
        flexWrap="wrap"
      >
        <Stack direction="row" alignItems="center" gap="14px" minWidth={0} flexWrap="wrap">
          <Typography
            component="h1"
            sx={{ ...text.pageTitle, fontFamily: mono, fontSize: 20, letterSpacing: '-0.02em' }}
          >
            {sb.id}
          </Typography>
          <SandboxStatusLabel
            status={sb.status}
            reason={sb.status === 'failed' || sb.status === 'terminated' ? sb.exit_reason : undefined}
          />
        </Stack>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {error && (
            <Typography sx={{ ...text.caption, color: color.danger }} title={error}>
              Refresh failed
            </Typography>
          )}
          {live && (
            <Button variant="outlined" color="error" onClick={() => setTerminateOpen(true)}>
              Terminate
            </Button>
          )}
        </Stack>
      </Stack>

      <AgentBanner sb={sb} />

      <Box marginBottom="16px">
        <UsageMeter sandbox={sb} cpuHistory={cpuHistory} />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 360px' },
          gap: '16px',
          alignItems: 'start',
        }}
      >
        <Section>
          <Box marginTop="-8px" marginBottom="16px">
            <Tabs<Tab>
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'logs', label: 'Logs' },
                { id: 'exec', label: 'Exec' },
                { id: 'files', label: 'Files' },
                {
                  id: 'egress',
                  label: (
                    <>
                      Egress <Count n={entries.length} />
                      {refused > 0 && <Count n={refused} tone="danger" />}
                    </>
                  ),
                },
                {
                  id: 'usage',
                  label: (
                    <>
                      Usage <Count n={recs.length} />
                    </>
                  ),
                },
              ]}
            />
          </Box>
          {tab === 'logs' && <LogsPanel id={sb.id} status={sb.status} />}
          {tab === 'exec' && (
            <ExecPanel
              id={sb.id}
              status={sb.status}
              workdir={sb.workdir || '/workspace'}
              egress={sb.egress}
              onRan={() => setFilesKey((k) => k + 1)}
            />
          )}
          {tab === 'files' && <FilesPanel sb={sb} refreshKey={filesKey} />}
          {tab === 'egress' && (
            <SandboxEgress
              sb={sb}
              log={egress}
              onUpdated={(next) => {
                setChanged({ sb: next, at: Date.now() });
                reload();
              }}
            />
          )}
          {tab === 'usage' && (
            <Box>
              <Typography sx={{ ...text.secondary, marginBottom: '10px' }}>
                {live ? 'So far: ' : hasFinal ? 'In all: ' : 'So far (the last minute is on its way): '}
                {recordSumsLine(totals)}. One row per minute it ran.
              </Typography>
              {records.error && !records.data ? (
                <ReadError what="its usage" error={records.error} />
              ) : (
                <RecordsTable records={recs} />
              )}
            </Box>
          )}
        </Section>
        <Stack gap="16px">
          <Details sb={sb} />
          {tab !== 'egress' && <EgressRules sb={sb} onOpen={() => setTab('egress')} />}
        </Stack>
      </Box>

      {terminateOpen && <TerminateDialog sb={sb} open onClose={() => setTerminateOpen(false)} onDone={setTerminated} />}
    </Box>
  );
};

/** Keyed by id, so moving between sandboxes starts fresh. */
const SandboxDetailRoute = () => {
  const { id } = useParams<{ id: string }>();
  return <SandboxDetail key={id} />;
};

export default SandboxDetailRoute;
