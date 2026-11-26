import { ReactNode, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Alert, Box, Button, CircularProgress, LoadingButton, Stack, TextField, Typography } from '@cluster-apps/ui';
import { Dialog, DialogActions, DialogContent, DialogTitle, Link } from '@mui/material';
import { NavLink, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ExperimentalPill, Pill, Section } from '~/components';
import { useAccount } from '~/hooks';
import { useAgentDefinitions } from '~/compute/agentHooks';
import { AGENT_RUN_KIND, agentTimeout, LABEL, modelRule } from '~/compute/agentRun';
import { agentRuns } from '~/compute/agentRuns';
import { deleteAgent, saveRunFiles } from '~/compute/agentStore';
import { AGENT_DEFAULT_RESOURCES, type AgentDefinition } from '~/compute/agentDefinition';
import { effectiveOf, plannedCpu, plannedMemory } from '~/compute/resources';
import { errorMessage } from '~/compute/client';
import { useComputeClient } from '~/compute/ComputeProvider';
import { useSandboxes, useSecrets } from '~/compute/hooks';
import { color, mono, text } from '~/theme/tokens';
import { CodeBlock, Count, Tabs } from '../../Sandboxes/components/bits';
import { Field, Mono, ReadError, RuleCredentials } from '../../Sandboxes/components/ui';
import AddDefinitionDialog from '../components/AddDefinitionDialog';
import AgentCredentials from '../components/AgentCredentials';
import AgentEgress from '../components/AgentEgress';
import { agentPath, AGENTS_PATH, missingSecrets } from '../components/definition';
import MissingSecrets from '../components/MissingSecrets';
import { Label } from '../components/RunItems';
import RunsTable, { liveRuns, runRows } from '../components/RunsTable';

const Rule = ({
  host,
  methods,
  path,
  credential,
  placeholders,
  note,
}: {
  host: string;
  methods: string[];
  path?: string;
  credential?: string;
  placeholders?: string[];
  note?: ReactNode;
}) => (
  <Stack direction="row" alignItems="center" justifyContent="space-between" gap="10px" sx={{ padding: '6px 0' }}>
    <Box minWidth={0}>
      <Box component="span" sx={{ fontFamily: mono, fontSize: 12.5, fontWeight: 600 }}>
        {host}
        {path ?? ''}
      </Box>
      <Box component="span" sx={{ ...text.caption, marginLeft: '6px' }}>
        {methods.join(', ')}
      </Box>
      {note && <Typography sx={text.caption}>{note}</Typography>}
    </Box>
    <RuleCredentials rule={{ credential, placeholders }} />
  </Stack>
);

const Definition = ({ def, onEgress }: { def: AgentDefinition; onEgress?: () => void }) => {
  const m = modelRule(def);
  return (
    <Stack spacing="20px">
      {def.description && <Typography sx={text.body}>{def.description}</Typography>}
      <Box
        sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.3fr) minmax(0, 1fr)' }, gap: '20px' }}
      >
        <Box minWidth={0}>
          <Label>{def.harness === 'container' ? 'Command' : 'System prompt'}</Label>
          <Box
            component="pre"
            sx={{
              margin: 0,
              padding: '12px 14px',
              borderRadius: '10px',
              border: `1px solid ${color.border}`,
              backgroundColor: color.inset,
              fontFamily: mono,
              fontSize: 12.5,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              color: color.text,
              maxHeight: 300,
              overflow: 'auto',
            }}
          >
            {def.harness === 'container' ? (def.command ?? []).join(' ') : def.system_prompt || '(none)'}
          </Box>
        </Box>
        <Box minWidth={0}>
          <Field label="Image">
            <Mono>{def.image}</Mono>
          </Field>
          <Field label="Model">
            <Mono>{def.model.model}</Mono>
          </Field>
          <Field label="CPU">{plannedCpu(effectiveOf(def.resources, AGENT_DEFAULT_RESOURCES))}</Field>
          <Field label="Memory">{plannedMemory(effectiveOf(def.resources, AGENT_DEFAULT_RESOURCES))}</Field>
          <Field label="Time limit">{Math.round(agentTimeout(def) / 60)} min</Field>
          {def.policy && <Field label="Policy">{def.policy}</Field>}
          {def.max_turns != null && <Field label="Max turns">{def.max_turns}</Field>}
          {def.tools?.length ? (
            <Field label="Tools">
              <Stack direction="row" gap="4px" flexWrap="wrap" justifyContent="flex-end">
                {def.tools.map((t) => (
                  <Pill key={t} tone="primary">
                    {t}
                  </Pill>
                ))}
              </Stack>
            </Field>
          ) : null}
          {def.files && Object.keys(def.files).length > 0 && (
            <Field label="Files">
              <Mono>{Object.keys(def.files).join(', ')}</Mono>
            </Field>
          )}
        </Box>
      </Box>
      <Box>
        <Label>Network access on every run’s sandbox</Label>
        <Box sx={{ border: `1px solid ${color.border}`, borderRadius: '12px', padding: '6px 14px' }}>
          {(def.egress?.allow ?? []).map((r, i) => (
            <Rule
              key={i}
              host={r.host}
              methods={r.methods}
              path={r.path_prefix}
              credential={r.credential}
              placeholders={r.placeholders}
            />
          ))}
          <Rule
            host={m.host}
            methods={m.methods}
            path={m.path_prefix}
            credential={m.credential}
            note="The model, added by the run"
          />
        </Box>
        <Typography sx={{ ...text.caption, marginTop: '6px' }}>
          Everything else is refused by the egress proxy and shows in the run’s egress log.{' '}
          {onEgress && (
            <Link
              component="button"
              type="button"
              variant="caption"
              onClick={onEgress}
              sx={{ verticalAlign: 'baseline' }}
            >
              Change rules and credentials
            </Link>
          )}
        </Typography>
      </Box>
    </Stack>
  );
};

/** Back to the agents list, above the title. */
const BackToAgents = () => (
  <Box sx={{ marginBottom: '6px' }}>
    <Box
      component={NavLink}
      to={AGENTS_PATH}
      sx={{ ...text.secondary, textDecoration: 'none', '&:hover': { color: color.primary } }}
    >
      Agents
    </Box>
  </Box>
);

type Tab = 'definition' | 'runs' | 'egress' | 'json';
const TABS: Tab[] = ['definition', 'runs', 'egress', 'json'];

const AgentDetail = () => {
  const { bucket = '', name = '' } = useParams<{ bucket: string; name: string }>();
  const account = useAccount();
  const client = useComputeClient();
  const navigate = useNavigate();
  const defs = useAgentDefinitions([bucket]);
  const secrets = useSecrets();
  const runs = useSandboxes({ label: [`${LABEL.kind}=${AGENT_RUN_KIND}`, `${LABEL.agent}=${name}`] });
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab') as Tab | null;
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : 'definition';
  const setTab = (t: Tab) => {
    params.set('tab', t);
    setParams(params, { replace: true });
  };
  const [input, setInput] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingJson, setEditingJson] = useState(false);
  const [saved, setSaved] = useState(!!(useLocation().state as { saved?: boolean } | null)?.saved);

  const stored = defs.agents.find((a) => a.name === name);
  if (!stored) {
    return (
      <Box>
        <BackToAgents />
        <Stack direction="row" alignItems="center" gap="12px" marginBottom="16px" flexWrap="wrap">
          <Typography component="h1" sx={text.pageTitle}>
            {name}
          </Typography>
          <ExperimentalPill />
        </Stack>
        {defs.loading ? (
          <Box padding="40px" display="flex" justifyContent="center">
            <CircularProgress size={24} />
          </Box>
        ) : (
          <ReadError
            what={`agent ${name}`}
            error={defs.error ?? `there is no cere/agents/${name}.json in bucket ${bucket}`}
          />
        )}
      </Box>
    );
  }
  const def = stored.def;
  const missing = def ? missingSecrets(def, secrets.data) : [];
  const rows = runRows(
    runs.data?.items ?? [],
    liveRuns().filter((r) => r.def.name === name),
  );

  const run = () => {
    if (!def || !input.trim()) return;
    const runId = agentRuns.start({
      client,
      def,
      input: input.trim(),
      bucket,
      save: (sandboxId, files) => saveRunFiles(account.storage, bucket, sandboxId, files),
    });
    navigate(`/agents/runs/${runId}`);
  };

  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteAgent(account.storage, bucket, name);
      navigate(AGENTS_PATH);
    } catch (e) {
      setError(errorMessage(e));
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <Box>
      <BackToAgents />
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={2}
        marginBottom="16px"
        flexWrap="wrap"
      >
        <Stack direction="row" alignItems="baseline" gap="12px" flexWrap="wrap">
          <Typography component="h1" sx={text.pageTitle}>
            {name}
          </Typography>
          <ExperimentalPill />
          <Typography sx={{ fontFamily: mono, fontSize: 13, color: color.textTertiary }}>
            {bucket}/{stored.key}
          </Typography>
          {def && <Pill tone="primary">{def.harness}</Pill>}
        </Stack>
        <Stack direction="row" gap="10px" flexWrap="wrap">
          {def && (
            <Button variant="outlined" color="secondary" component={NavLink} to={`${agentPath(bucket, name)}/edit`}>
              Edit
            </Button>
          )}
          <Button variant="outlined" color="secondary" onClick={() => setEditingJson(true)}>
            Edit JSON
          </Button>
          <Button variant="outlined" color="error" onClick={() => setConfirmDelete(true)}>
            Delete definition
          </Button>
        </Stack>
      </Stack>
      {saved && (
        <Alert severity="success" onClose={() => setSaved(false)} sx={{ marginBottom: '16px' }}>
          Saved {name} to {bucket}. Runs from now on use this definition.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ marginBottom: '16px' }}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 380px' },
          gap: '16px',
          alignItems: 'start',
        }}
      >
        <Section>
          <Box marginTop="-8px" marginBottom="18px">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'definition', label: 'Definition' },
                {
                  id: 'runs',
                  label: (
                    <>
                      Runs <Count n={rows.length} />
                    </>
                  ),
                },
                { id: 'egress', label: 'Egress and credentials' },
                { id: 'json', label: 'JSON' },
              ]}
            />
          </Box>
          {tab === 'json' ? (
            <CodeBlock code={def ? JSON.stringify(def, null, 2) : stored.errors.join('\n')} />
          ) : tab === 'runs' ? (
            <Box sx={{ margin: '0 -22px -18px' }}>
              <RunsTable rows={rows} showAgent={false} empty={runs.data ? 'Not run yet.' : 'Reading…'} />
            </Box>
          ) : tab === 'egress' && def ? (
            <AgentEgress
              bucket={bucket}
              def={def}
              runs={runs.data?.items ?? []}
              onSaved={() => {
                defs.reload();
              }}
            />
          ) : def ? (
            <Definition def={def} onEgress={() => setTab('egress')} />
          ) : (
            <Alert severity="warning">
              This definition can’t run:
              {stored.errors.map((e) => (
                <div key={e}>{e}</div>
              ))}
            </Alert>
          )}
        </Section>

        <Stack gap="16px">
          <Section title="Run it">
            <Typography sx={{ ...text.secondary, marginTop: '-6px', marginBottom: '10px' }}>
              Creates a sandbox from this definition, runs the agent in it with your input, streams what it does, then
              terminates it, keeping its output and transcript.
            </Typography>
            <TextField
              value={input}
              onChange={(e) => setInput(e.target.value)}
              multiline
              minRows={4}
              fullWidth
              size="small"
              placeholder="What should the agent do?"
              inputProps={{ 'aria-label': 'Input for the agent' }}
              InputProps={{ sx: { fontSize: 14 } }}
            />
            {def && missing.length > 0 && (
              <Alert severity="warning" sx={{ marginTop: '10px', '& .MuiAlert-message': { width: '100%' } }}>
                <MissingSecrets def={def} missing={missing} onStored={secrets.reload} />
              </Alert>
            )}
            <Button
              variant="contained"
              fullWidth
              sx={{ marginTop: '10px' }}
              disabled={!def || !input.trim() || missing.length > 0 || (secrets.loading && !secrets.data)}
              onClick={run}
            >
              Run agent
            </Button>
          </Section>
          <AgentCredentials agent={name} runs={runs.data?.items ?? []} />
        </Stack>
      </Box>

      {editingJson && (
        <AddDefinitionDialog
          existing={defs.agents}
          initial={{
            bucket,
            name,
            source: def ? `${JSON.stringify(def, null, 2)}\n` : '',
          }}
          onClose={(s) => {
            setEditingJson(false);
            if (s) {
              setSaved(true);
              defs.reload();
            }
          }}
        />
      )}

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete {name}?</DialogTitle>
        <DialogContent dividers>
          <Typography sx={text.body}>
            This removes <Mono>{stored.key}</Mono> from bucket {bucket}. Its past runs and their sandboxes stay.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ padding: '14px 24px' }}>
          <Button variant="outlined" color="secondary" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <LoadingButton variant="contained" color="error" loading={deleting} onClick={remove}>
            Delete
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default observer(AgentDetail);
