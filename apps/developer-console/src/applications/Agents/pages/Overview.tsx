import { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Button, Stack, Typography } from '@cluster-apps/ui';
import { Link } from '@mui/material';
import { NavLink, useSearchParams } from 'react-router-dom';

import { PageHeader, Section } from '~/components';
import { useAccount } from '~/hooks';
import { useAgentDefinitions } from '~/compute/agentHooks';
import { bucketList, bucketNames } from '~/compute/agentStore';
import { AGENT_RUN_KIND, LABEL } from '~/compute/agentRun';
import { useCompute } from '~/compute/ComputeProvider';
import { useNow, useSandboxes, useSecrets } from '~/compute/hooks';
import { useCanSign } from '~/compute/walletSigning';
import { fmtAgo } from '~/compute/format';
import { isLive } from '~/compute/types';
import { inferenceConfig } from '~/inference/inferenceConfig';
import { color, text } from '~/theme/tokens';
import { CodeBlock } from '../../Sandboxes/components/bits';
import ComputeGate from '../../Sandboxes/components/ComputeGate';
import TokenSecretButton, { MODEL_KEY_SECRET } from '../../Sandboxes/components/TokenSecretButton';
import { BucketChip, Mono, ReadError } from '../../Sandboxes/components/ui';
import { EXAMPLES_RELEASE } from '../examples';
import ExampleRunDialog from '../components/ExampleRunDialog';
import {
  AGENTS_QUICKSTART_PYTHON,
  AGENTS_QUICKSTART_PYTHON_SETUP,
  AGENTS_QUICKSTART_SHELL,
} from '../components/quickstart';
import { useCredentialDialogs } from '../../Sandboxes/components/credentials/CredentialDialogs';
import QuickstartTabs from '../../Sandboxes/components/QuickstartTabs';
import RunsTable, { liveRuns, runRows } from '../components/RunsTable';
import { AGENTS_PATH, EXAMPLE_MODEL_URL, NEW_AGENT_PATH, onConsoleGateway } from '../components/definition';

const Subhead = ({ children }: { children: string }) => (
  <Typography component="h3" sx={{ fontSize: 15, fontWeight: 700, marginBottom: '10px' }}>
    {children}
  </Typography>
);

const DAY_MS = 86_400_000;

const Count = ({ value, label, to }: { value: ReactNode; label: ReactNode; to?: string }) => {
  const body = (
    <>
      <Typography className="n" sx={text.amount}>
        {value}
      </Typography>
      <Typography sx={text.secondary}>{label}</Typography>
    </>
  );
  return to ? (
    <Box
      component={NavLink}
      to={to}
      sx={{ textDecoration: 'none', color: 'inherit', minWidth: 0, '&:hover .n': { color: color.primary } }}
    >
      {body}
    </Box>
  ) : (
    <Box minWidth={0}>{body}</Box>
  );
};

/** Live numbers, each read from its source: the bucket listing for definitions, the gateway for runs and secrets. */
const RightNow = observer(() => {
  const account = useAccount();
  const dialogs = useCredentialDialogs();
  const canSign = useCanSign();
  const list = bucketList(account.buckets, account.bucketsError);
  const defs = useAgentDefinitions(canSign ? bucketNames(list) : []);
  const runs = useSandboxes({ label: [`${LABEL.kind}:${AGENT_RUN_KIND}`] });
  const secrets = useSecrets();
  const now = useNow(10_000);
  const rows = runRows(runs.data?.items ?? [], liveRuns());
  const running = rows.filter((r) => (r.live && !r.live.endedAt) || (r.sandbox && isLive(r.sandbox.status))).length;
  const today = rows.filter((r) => now - r.startedAt < DAY_MS).length;
  /** No number at all when the read failed: "…" would say it is still coming. */
  const runsValue = (n: number | string) => (runs.data ? n : runs.error ? '—' : '…');
  const modelKey = secrets.data?.find((s) => s.name === MODEL_KEY_SECRET);
  const examplesOnConsoleGateway = onConsoleGateway(EXAMPLE_MODEL_URL, inferenceConfig.gatewayUrl);
  const buckets = list.state === 'ok' || list.state === 'stale' ? list.names.length : 0;

  const definitions = !canSign ? (
    <Count value="—" label="definitions: your wallet reads them" />
  ) : list.state === 'unreadable' ? (
    <Count value="—" label="definitions: buckets unreadable" />
  ) : defs.loading ? (
    <Count value="…" label="definitions" />
  ) : (
    <Count
      value={defs.agents.length}
      label={`definition${defs.agents.length === 1 ? '' : 's'} in ${buckets} storage bucket${buckets === 1 ? '' : 's'}`}
      to={AGENTS_PATH}
    />
  );

  return (
    <Section
      title="Right now"
      fill
      actions={
        <Button component={NavLink} to="/agents/runs" variant="text" color="secondary" size="small">
          All runs
        </Button>
      }
    >
      <Stack direction="row" gap="28px" marginBottom="16px" flexWrap="wrap">
        {definitions}
        <Count value={runsValue(running)} label="running now" to="/agents/runs" />
        <Count
          value={runsValue(`${today}${runs.data?.truncated ? '+' : ''}`)}
          label="runs in the last 24 h"
          to="/agents/runs"
        />
      </Stack>
      {list.state === 'unreadable' && canSign && (
        <Box marginBottom="10px">
          <ReadError what="your storage buckets" error={list.error} />
        </Box>
      )}
      {defs.error && (
        <Box marginBottom="10px">
          <ReadError what="agent definitions" error={defs.error} />
        </Box>
      )}
      {canSign && defs.failed.length > 0 && (
        <Typography sx={{ ...text.caption, color: color.warning, marginBottom: '10px' }} title={defs.failed[0].error}>
          Couldn’t list definitions in {defs.failed.length} of {buckets} storage bucket{buckets === 1 ? '' : 's'}:{' '}
          {defs.failed[0].error}
        </Typography>
      )}
      {runs.error && !runs.data ? (
        <ReadError what="runs" error={runs.error} />
      ) : (
        <Box sx={{ margin: '0 -22px', borderTop: `1px solid ${color.grid}` }}>
          <RunsTable rows={rows.slice(0, 5)} empty={runs.data ? 'No runs yet. Run an example.' : 'Reading…'} />
        </Box>
      )}
      <Stack gap="8px" marginTop="16px">
        {secrets.error && !secrets.data ? (
          <ReadError what="your secrets" error={secrets.error} />
        ) : (
          <Typography sx={text.secondary}>
            {!secrets.data ? (
              'Reading your secrets…'
            ) : modelKey ? (
              <>
                The examples’ model key <Mono>{MODEL_KEY_SECRET}</Mono> is in this bucket, sent only to{' '}
                <Mono>{(modelKey.hosts ?? []).join(', ') || 'no host'}</Mono>, updated{' '}
                <span title={modelKey.updated_at}>{fmtAgo(modelKey.updated_at, now)}</span>.
              </>
            ) : (
              <>
                This bucket has no <Mono>{MODEL_KEY_SECRET}</Mono> yet, the examples’ model key.
              </>
            )}
          </Typography>
        )}
        {secrets.error && !secrets.data ? null : examplesOnConsoleGateway ? (
          <TokenSecretButton held={modelKey} onStored={secrets.reload} />
        ) : (
          <Typography sx={text.caption}>
            This console’s inference gateway (<Mono>{inferenceConfig.gatewayUrl}</Mono>) is not the examples’ one, so
            its token is not their key:{' '}
            <Link
              component="button"
              type="button"
              variant="caption"
              onClick={() => void dialogs.store({ suggested: MODEL_KEY_SECRET })}
            >
              add a key of their gateway
            </Link>
            .
          </Typography>
        )}
      </Stack>
    </Section>
  );
});

/** What a run is made of, in the order a run passes through it. */
const PARTS: { name: string; body: ReactNode }[] = [
  {
    name: 'Definition',
    body: (
      <>
        A <Mono>cere.agent/v1</Mono> document in one of your storage buckets, at{' '}
        <Mono>cere/agents/&lt;name&gt;.json</Mono>: harness and image, system prompt, model, tools, limits and the hosts
        it may reach. The CLI, the SDK and this console read the same file.
      </>
    ),
  },
  {
    name: 'Sandbox',
    body: 'Each run is a new gVisor sandbox from the definition, labelled with the agent and the run. The agent runs in it with your input, then it is terminated, keeping its output and transcript.',
  },
  {
    name: 'Egress proxy',
    body: (
      <>
        The run can reach only the definition’s hosts and the model’s. The proxy adds the model key and the tools’
        credentials to those requests and logs each one; the agent never holds them. When a run is refused a host, its
        page offers to allow it, for that run or for the agent’s next runs.
      </>
    ),
  },
  {
    name: 'Usage',
    body: 'CPU and memory are measured on the node and metered to your compute bucket, like any sandbox. Model calls on this network’s inference gateway bill to the same bucket.',
  },
];

const Overview = () => {
  const compute = useCompute();
  const dialogs = useCredentialDialogs();
  const [params, setParams] = useSearchParams();
  const exampleOpen = params.get('example') === '1' && compute.status === 'ready';
  const setExample = (open: boolean) => {
    if (open) params.set('example', '1');
    else params.delete('example');
    setParams(params, { replace: !open });
  };

  return (
    <Box>
      <Box marginBottom="20px">
        <PageHeader
          title="Agents"
          subtitle="An agent is a definition in your bucket, run in a sandbox. Its model key and tool credentials stay with the bucket: the egress proxy adds them to the run’s requests, so the agent never holds them."
          actions={
            <>
              <BucketChip bucketId={compute.bucketId} />
              <Button component={NavLink} to={NEW_AGENT_PATH} variant="outlined" color="secondary">
                Create agent
              </Button>
            </>
          }
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.5fr) minmax(360px, 1fr)' },
          gap: '16px',
          marginBottom: '16px',
        }}
      >
        <Section title="Quickstart">
          <Stack spacing="20px">
            <Box>
              <QuickstartTabs
                cli={<CodeBlock code={AGENTS_QUICKSTART_SHELL} />}
                python={
                  <Stack spacing="12px">
                    <CodeBlock code={AGENTS_QUICKSTART_PYTHON_SETUP} />
                    <CodeBlock code={AGENTS_QUICKSTART_PYTHON} />
                  </Stack>
                }
              />
              <Typography sx={{ ...text.caption, marginTop: '8px' }}>
                Install the <Mono>cere</Mono> CLI (and, for Python, the SDK) and sign in first:{' '}
                <NavLink to="/sandboxes">Sandboxes › Overview</NavLink>, steps 1 and 2 ({EXAMPLES_RELEASE}). The model
                key is the token you signed in with; it stops working when that sign-in expires, so store it again after
                the next <Mono>cere login</Mono>. <Mono>sre.json</Mono> also needs{' '}
                <Link
                  component="button"
                  type="button"
                  variant="caption"
                  sx={{ verticalAlign: 'baseline' }}
                  onClick={() => void dialogs.store({ suggested: 'github-readonly', hosts: ['api.github.com'] })}
                >
                  github-readonly
                </Link>
                , a read-only GitHub token bound to <Mono>api.github.com</Mono>.
              </Typography>
            </Box>
            <Box>
              <Subhead>Try it here</Subhead>
              <Stack direction="row" alignItems="center" gap="16px" flexWrap="wrap">
                <Button variant="contained" onClick={() => setExample(true)} disabled={compute.status !== 'ready'}>
                  Run an example
                </Button>
                <Typography sx={{ ...text.secondary, flex: 1, minWidth: 240 }}>
                  Runs research, langgraph or sre from the release in a sandbox on the cluster and streams what the
                  agent does. Or <NavLink to={NEW_AGENT_PATH}>create your own</NavLink>.
                </Typography>
              </Stack>
            </Box>
          </Stack>
        </Section>
        {compute.status === 'ready' ? <RightNow /> : <ComputeGate>{null}</ComputeGate>}
      </Box>

      <Section title="How an agent runs">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' } }}>
          {PARTS.map((p, i) => (
            <Box
              key={p.name}
              sx={{
                padding: { xs: '12px 0', md: '4px 22px 4px 0' },
                marginRight: { md: i < PARTS.length - 1 ? '22px' : 0 },
                borderRight: { md: i < PARTS.length - 1 ? `1px solid ${color.grid}` : 'none' },
              }}
            >
              <Typography sx={{ fontSize: 15, fontWeight: 700, marginBottom: '4px' }}>{p.name}</Typography>
              <Typography sx={text.secondary}>{p.body}</Typography>
            </Box>
          ))}
        </Box>
      </Section>

      {exampleOpen && <ExampleRunDialog onClose={() => setExample(false)} />}
    </Box>
  );
};

export default observer(Overview);
