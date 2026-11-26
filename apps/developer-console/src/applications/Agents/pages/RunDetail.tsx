import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@cluster-apps/ui';
import { NavLink, useParams } from 'react-router-dom';

import { ExperimentalPill, Pill, Section } from '~/components';
import { useAccount } from '~/hooks';
import { outcomeOf, type RunOutcome } from '~/compute/agentOutcome';
import { LABEL, parseRunOutput, type RunOutput, type RunStep } from '~/compute/agentRun';
import { agentRuns } from '~/compute/agentRuns';
import { readRunFile } from '~/compute/agentStore';
import { ComputeError, errorMessage } from '~/compute/client';
import { useComputeClient } from '~/compute/ComputeProvider';
import { useEgressLog, useNow, useSandboxes } from '~/compute/hooks';
import { fmtDuration, plural, shortNode } from '~/compute/format';
import { foldEvents, transcriptItems } from '~/compute/runView';
import { isLive, type Sandbox } from '~/compute/types';
import { color, mono, text } from '~/theme/tokens';
import { Markdown, Tabs } from '../../Sandboxes/components/bits';
import EgressTable from '../../Sandboxes/components/detail/EgressTable';
import SandboxEgress from '../../Sandboxes/components/egress/SandboxEgress';
import { denials } from '~/compute/egressRules';
import { AGENTS_PATH, agentPath } from '../components/definition';
import { Mono, ReadError, SandboxStatusLabel } from '../../Sandboxes/components/ui';
import { billedText } from '../../Sandboxes/components/BilledUsage';
import { RunOutcomePill } from '../components/RunOutcome';
import { Label, RunItems } from '../components/RunItems';

const STEPS: { id: RunStep; label: string }[] = [
  { id: 'create', label: 'Create the sandbox' },
  { id: 'start', label: 'Start it' },
  { id: 'files', label: 'Write the input' },
  { id: 'run', label: 'Run the agent' },
  { id: 'collect', label: 'Read the output' },
  { id: 'save', label: 'Copy to the bucket' },
  { id: 'terminate', label: 'Terminate, keeping the files' },
];

type FileState = { text: string | null; from: 'sandbox' | 'bucket' | null; error: string | null; loading: boolean };

/**
 * A run file: from the sandbox (while it runs, or retained after), else from
 * the bucket copy at cere/runs/<sandbox-id>/. `pollMs` re-reads while the run
 * goes on (e.g. the transcript of a run another client drives).
 */
function useRunFile(sb: Sandbox | null, name: string, pollMs: number | null, version: number): FileState {
  const client = useComputeClient();
  const account = useAccount();
  const buckets = account.buckets?.map((b) => b.name) ?? [];
  const bucketsKey = buckets.join(',');
  const [state, setState] = useState<FileState>({ text: null, from: null, error: null, loading: true });
  const id = sb?.id;
  const retained = sb ? sb.retained.includes(`/workspace/${name}`) : false;
  const running = sb ? isLive(sb.status) : false;

  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    const read = async () => {
      try {
        if (running || retained) {
          const t = await (await client.getFile(id, `/workspace/${name}`)).text();
          if (alive) setState({ text: t, from: 'sandbox', error: null, loading: false });
          return;
        }
      } catch (e) {
        if (!(e instanceof ComputeError && (e.status === 404 || e.status === 410))) {
          if (alive) setState((s) => ({ ...s, error: errorMessage(e), loading: false }));
          return;
        }
      }
      const copy = await readRunFile(account.storage, bucketsKey ? bucketsKey.split(',') : [], id, name);
      if (alive)
        setState(
          copy
            ? { text: copy.text, from: 'bucket', error: null, loading: false }
            : { text: null, from: null, error: null, loading: false },
        );
    };
    void read();
    const t = pollMs && running ? window.setInterval(read, pollMs) : undefined;
    return () => {
      alive = false;
      if (t) window.clearInterval(t);
    };
  }, [client, account, id, name, running, retained, pollMs, bucketsKey, version]);
  // Nothing to read (no sandbox yet, or this tab streams the run itself): not "loading".
  return id ? state : NO_FILE;
}

const NO_FILE: FileState = { text: null, from: null, error: null, loading: false };

const Output = ({
  output,
  from,
  empty,
  errorShown,
}: {
  output: RunOutput | null;
  from?: string | null;
  empty: string;
  /** The page already shows the run's error above. */
  errorShown: boolean;
}) => {
  if (!output) return <Typography sx={text.secondary}>{empty}</Typography>;
  const usage = output.model_usage ?? {};
  // Runner images before 0.1.1 also wrote a failed model call's message as the answer.
  const answer = output.error && output.output && output.error.includes(output.output.trim()) ? '' : output.output;
  return (
    <Box>
      {output.error && !errorShown && (
        <Alert severity="error" sx={{ marginBottom: '12px' }}>
          {output.error}
        </Alert>
      )}
      {answer ? (
        <Markdown source={answer} />
      ) : (
        <Typography sx={text.secondary}>
          {output.error ? 'The agent returned no answer.' : 'The agent returned no text.'}
        </Typography>
      )}
      <Stack
        direction="row"
        gap="16px"
        flexWrap="wrap"
        marginTop="12px"
        sx={{ ...text.caption, fontVariantNumeric: 'tabular-nums' }}
      >
        {output.turns != null && <span>{plural(output.turns, 'model turn')}</span>}
        {output.tool_calls != null && (
          <span>
            {plural(output.tool_calls, 'tool call')}
            {output.denied ? `, ${output.denied} refused by the agent’s policy` : ''}
          </span>
        )}
        {typeof usage.input_tokens === 'number' && (
          <span>
            {usage.input_tokens.toLocaleString('en-US')} input /{' '}
            {Number(usage.output_tokens ?? 0).toLocaleString('en-US')} output tokens, as the harness reports them
          </span>
        )}
        {output.duration_s != null && <span>{fmtDuration(output.duration_s)}</span>}
        {from && <span>read from the {from}</span>}
      </Stack>
    </Box>
  );
};

/** Back to the runs list, above the title. */
const BackToRuns = () => (
  <Box sx={{ marginBottom: '6px' }}>
    <Box
      component={NavLink}
      to="/agents/runs"
      sx={{ ...text.secondary, textDecoration: 'none', '&:hover': { color: color.primary } }}
    >
      Runs
    </Box>
  </Box>
);

const RunTitle = ({ runId }: { runId: string }) => (
  <Typography component="h1" sx={{ ...text.pageTitle, fontFamily: mono, fontSize: 20 }}>
    {runId}
  </Typography>
);

const RunDetail = () => {
  const { runId = '' } = useParams<{ runId: string }>();
  const live = agentRuns.get(runId);
  const listed = useSandboxes({ label: [`${LABEL.run}:${runId}`] });
  // This tab's final copy of the sandbox is newer than the last listing.
  const sb: Sandbox | null =
    (live?.sandbox && !isLive(live.sandbox.status) ? live.sandbox : null) ??
    listed.data?.items[0] ??
    live?.sandbox ??
    null;
  const egress = useEgressLog({ sandbox_id: sb?.id }, { enabled: !!sb });
  const now = useNow(1000);
  const [tab, setTab] = useState<'did' | 'egress'>('did');
  const driving = !!live && !live.endedAt;
  const ended = live ? !!live.endedAt : sb ? !isLive(sb.status) : false;
  // Re-read the files once this tab's run has finished writing them.
  const version = live?.endedAt ?? 0;
  const transcript = useRunFile(driving ? null : sb, 'transcript.jsonl', 5000, version);
  const outputFile = useRunFile(driving || live?.result?.output ? null : sb, 'output.json', 10_000, version);
  const inputFile = useRunFile(live ? null : sb, 'input.txt', null, version);

  if (!sb && !live) {
    return (
      <Box>
        <BackToRuns />
        <Stack direction="row" alignItems="center" gap="12px" marginBottom="16px" flexWrap="wrap">
          <RunTitle runId={runId} />
          <ExperimentalPill />
        </Stack>
        {listed.loading ? (
          <Box padding="40px" display="flex" justifyContent="center">
            <CircularProgress size={24} />
          </Box>
        ) : (
          <ReadError what={`run ${runId}`} error={listed.error ?? 'no sandbox carries this run id'} />
        )}
      </Box>
    );
  }

  const agent = sb?.labels[LABEL.agent] ?? live?.def.name ?? '—';
  const harness = sb?.labels[LABEL.harness] ?? live?.def.harness ?? '—';
  const output = live?.result?.output ?? (outputFile.text ? parseRunOutput(outputFile.text) : null);
  const t = transcript.text ? transcriptItems(transcript.text) : null;
  const items = live && live.events.length ? foldEvents(live.events) : (t?.items ?? []);
  const input = live?.input ?? t?.prompt ?? inputFile.text;
  const started = live?.startedAt ?? (sb ? Date.parse(sb.created_at) : now);
  const end = live?.endedAt ?? (sb?.ended_at ? Date.parse(sb.ended_at) : now);
  const stepIndex = live ? STEPS.findIndex((s) => s.id === live.step) : -1;
  const entries = (egress.data?.items ?? []).filter((e) => e.decision !== 'policy');
  const denied = entries.filter((e) => e.decision === 'denied').length;
  // Hosts still refused under the sandbox's current rules: what the agent couldn't reach.
  const refusedHosts = [...new Set(denials(entries, () => sb?.egress.allow ?? []).map((d) => d.host))];
  const sbLive = !!sb && isLive(sb.status);
  const defPage = live?.bucket && agent !== '—' ? `${agentPath(live.bucket, agent)}?tab=egress` : AGENTS_PATH;
  // The run's result: this tab's own while it drives the run, else what its
  // sandbox records (agentOutcome.ts), read the same way by the CLI and the SDK.
  let outcome: RunOutcome | null = null;
  if (driving) outcome = { state: 'running' };
  else if (sb && !isLive(sb.status)) outcome = outcomeOf(sb);
  else if (live?.endedAt) {
    const error = live.result?.error;
    outcome =
      error === 'Stopped.'
        ? { state: 'stopped', detail: 'Stopped by its client.' }
        : error
          ? { state: 'failed', detail: error }
          : { state: 'succeeded' };
  }
  // The recorded reason is cut to 120 bytes; the kept output.json has the whole error.
  const failure =
    outcome && outcome.state !== 'running' && outcome.state !== 'succeeded'
      ? (outcome.state === 'failed' && output?.error) || outcome.detail
      : null;

  return (
    <Box>
      <BackToRuns />
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={2}
        marginBottom="16px"
        flexWrap="wrap"
      >
        <Stack direction="row" alignItems="center" gap="12px" flexWrap="wrap">
          <RunTitle runId={runId} />
          <ExperimentalPill />
          {outcome ? <RunOutcomePill outcome={outcome} /> : <Pill tone="primary">Running elsewhere</Pill>}
          <Typography sx={text.secondary}>
            {agent} · {harness} · {fmtDuration((end - started) / 1000)}
          </Typography>
        </Stack>
        {driving && (
          <Button variant="outlined" color="error" onClick={() => agentRuns.stop(runId)}>
            Stop
          </Button>
        )}
      </Stack>

      {sb && (
        <Stack
          direction="row"
          alignItems="center"
          gap="12px"
          flexWrap="wrap"
          sx={{
            padding: '10px 14px',
            borderRadius: '10px',
            border: `1px dashed ${color.border}`,
            backgroundColor: color.inset,
            marginBottom: '16px',
          }}
        >
          <Typography sx={{ ...text.secondary, color: color.text }}>Sandbox</Typography>
          <Box
            component={NavLink}
            to={`/sandboxes/list/${sb.id}`}
            sx={{
              fontFamily: mono,
              fontSize: 13,
              fontWeight: 700,
              color: color.primary,
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {sb.id}
          </Box>
          <SandboxStatusLabel status={sb.status} reason={!isLive(sb.status) ? sb.exit_reason : undefined} />
          <Typography sx={text.secondary}>
            node <Mono title={sb.node}>{shortNode(sb.node)}</Mono> · {billedText(sb)}
          </Typography>
        </Stack>
      )}

      {failure && (
        <Alert severity={outcome?.state === 'failed' ? 'error' : 'info'} sx={{ marginBottom: '16px' }}>
          {outcome?.state === 'stopped' ? 'Stopped before it finished.' : failure}
        </Alert>
      )}
      {!live && sb && isLive(sb.status) && (
        <Alert severity="info" sx={{ marginBottom: '16px' }}>
          Another client (the CLI, the SDK or another tab) is driving this run. Its transcript below is read from the
          sandbox every few seconds.
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(0, 1fr)' },
          gap: '16px',
          alignItems: 'start',
        }}
      >
        <Stack gap="16px" minWidth={0}>
          <Section title="Input">
            <Typography sx={{ ...text.body, whiteSpace: 'pre-wrap' }}>
              {input ?? (inputFile.loading ? 'Reading…' : 'Not kept.')}
            </Typography>
          </Section>
          {live && (
            <Section title="Steps">
              <Stack spacing="6px">
                {STEPS.filter((s) => s.id !== 'save' || live.bucket).map((s) => {
                  const i = STEPS.findIndex((x) => x.id === s.id);
                  const done = live.step === 'done' || i < stepIndex;
                  const current = !done && i === stepIndex;
                  return (
                    <Stack key={s.id} direction="row" alignItems="center" gap="10px">
                      <Box
                        sx={{
                          width: 18,
                          textAlign: 'center',
                          color: done ? color.success : current ? color.primary : color.textTertiary,
                          fontWeight: 700,
                        }}
                      >
                        {done ? '✓' : current ? <CircularProgress size={12} thickness={6} /> : '·'}
                      </Box>
                      <Typography sx={{ ...text.body, color: done || current ? color.text : color.textTertiary }}>
                        {s.label}
                      </Typography>
                    </Stack>
                  );
                })}
              </Stack>
              {live.result?.saved.length ? (
                <Typography sx={{ ...text.caption, marginTop: '10px', fontFamily: mono }}>
                  Copied to {live.bucket}: {live.result.saved.join(', ')}
                </Typography>
              ) : null}
            </Section>
          )}
          <Section title="Output">
            {driving && !output ? (
              <Typography sx={text.secondary}>The answer appears here when the agent finishes.</Typography>
            ) : outputFile.error && !output ? (
              <ReadError what="output.json" error={outputFile.error} />
            ) : (
              <Output
                output={output}
                from={live?.result?.output ? null : outputFile.from}
                errorShown={!!failure}
                empty={
                  !ended
                    ? 'No output yet.'
                    : outputFile.loading
                      ? 'Reading…'
                      : sb && !sb.retained.includes('/workspace/output.json')
                        ? 'No output: the agent wrote no /workspace/output.json before the run ended.'
                        : 'No output was kept.'
                }
              />
            )}
          </Section>
        </Stack>

        <Section>
          {refusedHosts.length > 0 && (
            <Alert
              severity={sbLive ? 'warning' : 'info'}
              sx={{ marginBottom: '14px' }}
              action={
                sbLive ? (
                  <Button size="small" color="inherit" onClick={() => setTab('egress')}>
                    Review and allow
                  </Button>
                ) : (
                  <Button size="small" color="inherit" component={NavLink} to={defPage}>
                    Allow for next runs
                  </Button>
                )
              }
            >
              The egress proxy refused {refusedHosts.length === 1 ? 'a host' : `${refusedHosts.length} hosts`}:{' '}
              <Mono>{refusedHosts.slice(0, 4).join(', ')}</Mono>
              {refusedHosts.length > 4 ? ` and ${refusedHosts.length - 4} more` : ''}.{' '}
              {sbLive
                ? 'Allow it for this run’s sandbox: the next request goes through.'
                : 'This run has ended; allow it in the agent’s rules for its next runs.'}
            </Alert>
          )}
          <Box marginTop="-8px" marginBottom="14px">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'did', label: 'What it did' },
                { id: 'egress', label: `Egress (${entries.length}${denied ? `, ${denied} denied` : ''})` },
              ]}
            />
          </Box>
          {tab === 'did' ? (
            <Box>
              <Label>
                {driving || (live && live.events.length)
                  ? 'Live from the runner'
                  : transcript.from
                    ? `From transcript.jsonl in the ${transcript.from}`
                    : transcript.loading
                      ? 'Reading the transcript…'
                      : 'No transcript kept'}
              </Label>
              {transcript.error && !live && <ReadError what="transcript.jsonl" error={transcript.error} />}
              <RunItems items={items} working={driving || (!live && !!sb && isLive(sb.status))} />
            </Box>
          ) : sb ? (
            <SandboxEgress sb={sb} log={egress} onUpdated={() => listed.reload()} />
          ) : (
            <EgressTable entries={entries} empty="The sandbox isn’t created yet." />
          )}
        </Section>
      </Box>
    </Box>
  );
};

const RunDetailObserved = observer(RunDetail);

/** Keyed by run id, so moving between runs starts fresh. */
const RunDetailRoute = () => {
  const { runId } = useParams<{ runId: string }>();
  return <RunDetailObserved key={runId} />;
};

export default RunDetailRoute;
