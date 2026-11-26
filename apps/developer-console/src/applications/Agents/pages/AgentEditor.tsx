import { ReactNode, useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  LoadingButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@cluster-apps/ui';
import { Autocomplete } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom';

import { ExperimentalPill, PageHeader, Section } from '~/components';
import { useAccount } from '~/hooks';
import { AGENT_DEFAULT_RESOURCES, agentKey, type AgentDefinition } from '~/compute/agentDefinition';
import { useAgentDefinitions } from '~/compute/agentHooks';
import { bucketNames, saveAgent } from '~/compute/agentStore';
import { errorMessage } from '~/compute/client';
import { coverageBlocks } from '~/compute/egressCoverage';
import { bucketSecrets, credentialsFor } from '~/compute/credentials';
import { useSecrets } from '~/compute/hooks';
import { NO_WALLET_HERE, useCanSign } from '~/compute/walletSigning';
import type { HttpMethod } from '~/compute/types';
import { anthropicBaseUrl } from '~/inference/gateway';
import { chatModelChoices } from '~/inference/model';
import { useModels } from '~/inference/useInference';
import { color, mono, text } from '~/theme/tokens';
import { CodeBlock } from '../../Sandboxes/components/bits';
import ResourceInputs from '../../Sandboxes/components/ResourceInputs';
import TokenSecretButton, { MODEL_KEY_SECRET } from '../../Sandboxes/components/TokenSecretButton';
import { CredentialChip, Mono, ReadError } from '../../Sandboxes/components/ui';
import { Chip } from '../../Sandboxes/pages/SandboxList';
import {
  CLAUDE_CODE_TOOLS,
  definitionFromForm,
  emptyForm,
  emptyRule,
  formCoverage,
  formFromDefinition,
  modelHost,
  RULE_METHODS,
  RUNNER_IMAGE,
  type AgentForm,
  type FormErrors,
  type RuleForm,
} from '../components/agentForm';
import {
  CoverageNote,
  CredentialSelect,
  PlaceholderHint,
  type Pickable,
} from '../../Sandboxes/components/credentials/CredentialPicker';
import { agentPath, AGENTS_PATH } from '../components/definition';
import StorageBucketField, { useStorageBucket } from '../components/StorageBucketField';

const MONO_INPUT = { sx: { fontFamily: mono, fontSize: 13 } };

const Label = ({ children, hint }: { children: ReactNode; hint?: ReactNode }) => (
  <Box marginBottom="8px">
    <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{children}</Typography>
    {hint && <Typography sx={text.secondary}>{hint}</Typography>}
  </Box>
);

/** The fields of one egress rule, its credential and whether that credential may be sent to its host. */
const RuleRow = ({
  rule,
  error,
  coverage,
  secrets,
  onChange,
  onRemove,
}: {
  rule: RuleForm;
  error?: string;
  coverage: ReturnType<typeof formCoverage>['rules'][number];
  secrets: Pickable[] | undefined;
  onChange: (patch: Partial<RuleForm>) => void;
  onRemove: () => void;
}) => {
  const toggle = (m: HttpMethod) =>
    onChange({ methods: rule.methods.includes(m) ? rule.methods.filter((x) => x !== m) : [...rule.methods, m] });
  return (
    <Box sx={{ border: `1px solid ${color.border}`, borderRadius: '12px', padding: '12px 14px' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} gap="10px" alignItems={{ md: 'flex-start' }}>
        <TextField
          placeholder="api.example.com"
          value={rule.host}
          onChange={(e) => onChange({ host: e.target.value })}
          size="small"
          sx={{ flex: 1.3 }}
          error={!!error}
          inputProps={{ 'aria-label': 'Host', style: { fontFamily: mono, fontSize: 13 } }}
        />
        <TextField
          placeholder="/path prefix (optional)"
          value={rule.path}
          onChange={(e) => onChange({ path: e.target.value })}
          size="small"
          sx={{ flex: 1 }}
          inputProps={{ 'aria-label': 'Path prefix', style: { fontFamily: mono, fontSize: 13 } }}
        />
        <Box sx={{ flex: 1.1, minWidth: 0 }}>
          <CredentialSelect
            value={rule.credential}
            onChange={(credential) => onChange({ credential })}
            secrets={secrets}
            host={rule.host.trim().toLowerCase()}
            ariaLabel="Credential"
            placeholders={rule.placeholders}
            onPlaceholders={(placeholders) => onChange({ placeholders })}
          />
        </Box>
        <IconButton aria-label="Remove this rule" size="small" onClick={onRemove} sx={{ alignSelf: 'center' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Stack direction="row" gap="6px" flexWrap="wrap" marginTop="10px" alignItems="center">
        {RULE_METHODS.map((m) => (
          <Chip key={m} active={rule.methods.includes(m)} onClick={() => toggle(m)}>
            {m}
          </Chip>
        ))}
      </Stack>
      {rule.placeholders && (
        <Box marginTop="6px">
          <PlaceholderHint names={rule.placeholders} />
        </Box>
      )}
      {error && <Typography sx={{ ...text.caption, color: color.danger, marginTop: '6px' }}>{error}</Typography>}
      {!error &&
        coverage.map((c, i) => (
          <Box marginTop="6px" key={i}>
            <CoverageNote coverage={c} host={rule.host.trim().toLowerCase()} />
          </Box>
        ))}
    </Box>
  );
};

/**
 * Create or edit an agent with a form. Saves the same `cere.agent/v1` JSON the
 * import dialog and `cere agent push` write, to `cere/agents/<name>.json` in
 * the chosen storage bucket; the preview shows exactly what is saved. The
 * model can be this network's inference gateway (its model list is the one the
 * Inference pages read), and each egress rule's credential is picked from the
 * bucket's secrets, with a warning when a secret isn't bound to the rule's host.
 */
const AgentEditor = () => {
  const { bucket: editBucket, name: editName } = useParams<{ bucket: string; name: string }>();
  const editing = useMemo(
    () => (editBucket && editName ? { bucket: editBucket, name: editName } : null),
    [editBucket, editName],
  );
  const account = useAccount();
  const navigate = useNavigate();
  const canSign = useCanSign();
  const choice = useStorageBucket();
  const defs = useAgentDefinitions(editing ? [editing.bucket] : bucketNames(choice.list));
  const secrets = useSecrets();
  const models = useModels();
  const clusterBase = anthropicBaseUrl();

  // "Open in the form" from an example starts from that definition.
  const template = (useLocation().state as { template?: AgentDefinition } | null)?.template;
  const [form, setForm] = useState<AgentForm | null>(() =>
    editing
      ? null
      : template
        ? formFromDefinition(template)
        : emptyForm({ baseUrl: clusterBase, model: '', credential: MODEL_KEY_SECRET }),
  );
  const stored = editing ? defs.agents.find((a) => a.name === editing.name) : undefined;
  useEffect(() => {
    if (editing && !form && stored?.def) setForm(formFromDefinition(stored.def));
  }, [editing, form, stored]);

  const modelChoices = useMemo(() => chatModelChoices(models.cards), [models.cards]);
  // A new agent on the cluster's gateway starts with the first model it serves, once.
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (editing || prefilled || !form || !modelChoices[0]) return;
    setPrefilled(true);
    if (!form.model && form.baseUrl === clusterBase) setForm({ ...form, model: modelChoices[0] });
  }, [editing, prefilled, form, clusterBase, modelChoices]);

  const [gateway, setGateway] = useState<'cluster' | 'other' | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (editing && !form) {
    return (
      <Box>
        <Box marginBottom="20px">
          <PageHeader title={`Edit ${editing.name}`} badge={<ExperimentalPill />} />
        </Box>
        {defs.loading ? (
          <Box padding="40px" display="flex" justifyContent="center">
            <CircularProgress size={24} />
          </Box>
        ) : !canSign ? (
          <Alert severity="info">Editing a definition reads it from your storage bucket. {NO_WALLET_HERE}</Alert>
        ) : stored && !stored.def ? (
          <Alert severity="warning">
            {editing.name} can’t be opened in the form: {stored.errors.join(' ')} Fix it as JSON from{' '}
            <NavLink to={agentPath(editing.bucket, editing.name)}>its page</NavLink>.
          </Alert>
        ) : (
          <ReadError
            what={`agent ${editing.name}`}
            error={defs.error ?? `there is no ${agentKey(editing.name)} in bucket ${editing.bucket}`}
          />
        )}
      </Box>
    );
  }
  if (!form) return null;

  const mode = gateway ?? (form.baseUrl.replace(/\/+$/, '') === clusterBase ? 'cluster' : 'other');
  const { def, draft, errors } = definitionFromForm(form);
  // The definition's credential names resolve, at run time, in the agent's secrets, then the bucket's.
  const creds = credentialsFor(secrets.data, { agent: form.name.trim() });
  const coverage = formCoverage(form, creds);
  const show = (k: keyof FormErrors) => (attempted || dirty.has(k) ? (errors[k] as string | undefined) : undefined);
  const set = (patch: Partial<AgentForm>) => {
    setForm({ ...form, ...patch });
    setDirty((d) => new Set([...d, ...Object.keys(patch)]));
  };
  const setRule = (i: number, patch: Partial<RuleForm>) =>
    set({ rules: form.rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const bucket = editing?.bucket ?? choice.bucket;
  const replaces = !editing && !!def && defs.agents.some((a) => a.bucket === bucket && a.key === agentKey(def.name));
  const blocking = [coverage.model, ...coverage.rules.flat()].filter(coverageBlocks).length;
  const claudeCode = form.harness === 'claude-code';

  const save = async () => {
    setAttempted(true);
    if (!def || !bucket || !canSign) return;
    setBusy(true);
    setError(null);
    try {
      await saveAgent(account.storage, bucket, def);
      navigate(agentPath(bucket, def.name), { state: { saved: true } });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Box>
      <Box sx={{ marginBottom: '6px' }}>
        <Box
          component={NavLink}
          to={editing ? agentPath(editing.bucket, editing.name) : AGENTS_PATH}
          sx={{ ...text.secondary, textDecoration: 'none', '&:hover': { color: color.primary } }}
        >
          {editing ? editing.name : 'Agents'}
        </Box>
      </Box>
      <Box marginBottom="20px">
        <PageHeader
          title={editing ? `Edit ${editing.name}` : 'Create agent'}
          badge={<ExperimentalPill />}
          subtitle="Every run of the agent is a new sandbox from this definition: the image and harness, the model, the tools and limits, and the hosts it may reach. Credentials stay with the bucket; the egress proxy adds them on the way out."
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 420px' },
          gap: '16px',
          alignItems: 'start',
        }}
      >
        <Stack gap="16px">
          <Section title="Agent">
            <Stack spacing="16px">
              <TextField
                label="Name"
                value={form.name}
                onChange={(e) => set({ name: e.target.value.toLowerCase() })}
                disabled={!!editing}
                size="small"
                error={!!show('name')}
                helperText={
                  show('name') ?? 'Lowercase letters, digits and dashes. The file is cere/agents/<name>.json.'
                }
                InputProps={MONO_INPUT}
              />
              <TextField
                label="Description"
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
                size="small"
                helperText="One line: what it does."
              />
              <TextField
                label="System prompt"
                value={form.systemPrompt}
                onChange={(e) => set({ systemPrompt: e.target.value })}
                multiline
                minRows={6}
                maxRows={18}
                helperText={
                  claudeCode
                    ? 'The runner gives it to Claude Code as the system prompt, then the run’s input as the task.'
                    : 'Written into /workspace/agent.json; your container decides how to use it.'
                }
                InputProps={{ sx: { fontSize: 14 } }}
              />
            </Stack>
          </Section>

          <Section title="Harness">
            <Stack spacing="16px">
              <Stack direction="row" gap="8px" flexWrap="wrap">
                <Chip
                  active={claudeCode}
                  onClick={() => set({ harness: 'claude-code', image: form.image.trim() ? form.image : RUNNER_IMAGE })}
                >
                  claude-code
                </Chip>
                <Chip active={!claudeCode} onClick={() => set({ harness: 'container' })}>
                  container
                </Chip>
              </Stack>
              <Typography sx={text.secondary}>
                {claudeCode
                  ? 'Claude Code in the agent runner image: the run execs ddc-agent-run with the definition and your input, and streams its events.'
                  : 'Your own image: the run execs your command in it. It reads /workspace/input.txt and /workspace/agent.json, writes /workspace/output.json, and reaches the model through ANTHROPIC_BASE_URL.'}
              </Typography>
              <Autocomplete
                freeSolo
                options={claudeCode ? [RUNNER_IMAGE] : []}
                value={form.image}
                onInputChange={(_, v) => set({ image: v })}
                renderInput={(p) => (
                  <TextField
                    {...p}
                    label="Image"
                    size="small"
                    error={!!show('image')}
                    helperText={
                      show('image') ??
                      (claudeCode ? 'The agent runner, or an image built on it.' : 'Any public registry image.')
                    }
                    InputProps={{ ...p.InputProps, ...MONO_INPUT }}
                  />
                )}
              />
              {!claudeCode && (
                <TextField
                  label="Command"
                  value={form.command}
                  onChange={(e) => set({ command: e.target.value })}
                  size="small"
                  placeholder="python /app/agent.py"
                  error={!!show('command')}
                  helperText={
                    show('command') ?? 'Run in the sandbox for each run. Quote arguments that contain spaces.'
                  }
                  InputProps={MONO_INPUT}
                />
              )}
            </Stack>
          </Section>

          <Section title="Model">
            <Stack spacing="16px">
              <TextField
                select
                label="Gateway"
                value={mode}
                onChange={(e) => {
                  const g = e.target.value as 'cluster' | 'other';
                  setGateway(g);
                  if (g === 'cluster') set({ baseUrl: clusterBase });
                }}
                size="small"
              >
                <MenuItem value="cluster">This network’s inference gateway ({modelHost(clusterBase)})</MenuItem>
                <MenuItem value="other">Another Anthropic-compatible endpoint</MenuItem>
              </TextField>
              {mode === 'other' && (
                <TextField
                  label="Base URL"
                  value={form.baseUrl}
                  onChange={(e) => set({ baseUrl: e.target.value })}
                  size="small"
                  placeholder="https://api.example.com/anthropic"
                  error={!!show('baseUrl')}
                  helperText={show('baseUrl') ?? 'The runner sets it as ANTHROPIC_BASE_URL; the run allows this host.'}
                  InputProps={MONO_INPUT}
                />
              )}
              <Autocomplete
                freeSolo
                options={mode === 'cluster' ? modelChoices : []}
                value={form.model}
                onInputChange={(_, v) => set({ model: v })}
                renderOption={(props, option) => {
                  const card = models.cards.find((c) => c.name === option);
                  return (
                    <li {...props} key={option}>
                      <Stack direction="row" justifyContent="space-between" width="100%" gap="12px">
                        <Box component="span" sx={{ fontFamily: mono, fontSize: 13 }}>
                          {option}
                        </Box>
                        {card && <Typography sx={text.caption}>{card.capacity.label}</Typography>}
                      </Stack>
                    </li>
                  );
                }}
                renderInput={(p) => (
                  <TextField
                    {...p}
                    label="Model"
                    size="small"
                    error={!!show('model')}
                    helperText={
                      show('model') ??
                      (mode === 'cluster'
                        ? models.error
                          ? `Couldn’t read the gateway’s models (${models.error}); type the model’s name.`
                          : models.loading
                            ? 'Reading the gateway’s models…'
                            : `${modelChoices.length} chat models served by this gateway, as Inference › Models lists them.`
                        : 'The model name that endpoint serves.')
                    }
                    InputProps={{ ...p.InputProps, ...MONO_INPUT }}
                  />
                )}
              />
              <Box>
                <CredentialSelect
                  label="Model key"
                  value={form.modelCredential}
                  onChange={(modelCredential) => set({ modelCredential })}
                  secrets={creds}
                  host={modelHost(form.baseUrl)}
                  noneLabel="No key"
                />
                <Typography sx={{ ...text.caption, marginTop: '6px' }}>
                  The credential the egress proxy adds to the run’s calls to{' '}
                  {modelHost(form.baseUrl) || 'the model host'}. The sandbox gets a placeholder key and never sees it.
                </Typography>
                {form.modelCredential && (
                  <Box marginTop="6px">
                    <CoverageNote coverage={coverage.model} host={modelHost(form.baseUrl)} />
                  </Box>
                )}
                {mode === 'cluster' &&
                  form.modelCredential &&
                  (coverage.model.state === 'missing' || coverage.model.state === 'not-covered') && (
                    <Box marginTop="10px">
                      <TokenSecretButton
                        name={form.modelCredential}
                        held={bucketSecrets(secrets.data)?.find((s) => s.name === form.modelCredential)}
                        onStored={secrets.reload}
                      />
                    </Box>
                  )}
              </Box>
            </Stack>
          </Section>

          <Section title="Tools and limits">
            <Stack spacing="18px">
              <Box>
                <Label
                  hint={
                    claudeCode
                      ? 'The Claude Code tools the agent may use. Without Bash it has no shell.'
                      : 'Your container’s own tool names; they are written into agent.json.'
                  }
                >
                  Tools
                </Label>
                {claudeCode && (
                  <Stack direction="row" gap="6px" flexWrap="wrap" marginBottom="10px">
                    {CLAUDE_CODE_TOOLS.map((t) => (
                      <Chip
                        key={t}
                        active={form.tools.includes(t)}
                        onClick={() =>
                          set({
                            tools: form.tools.includes(t) ? form.tools.filter((x) => x !== t) : [...form.tools, t],
                          })
                        }
                      >
                        {t}
                      </Chip>
                    ))}
                  </Stack>
                )}
                {(!claudeCode || form.tools.some((t) => !CLAUDE_CODE_TOOLS.includes(t))) && (
                  <Autocomplete
                    multiple
                    freeSolo
                    options={[]}
                    value={claudeCode ? form.tools.filter((t) => !CLAUDE_CODE_TOOLS.includes(t)) : form.tools}
                    onChange={(_, v) =>
                      set({
                        tools: claudeCode
                          ? [...form.tools.filter((t) => CLAUDE_CODE_TOOLS.includes(t)), ...(v as string[])]
                          : (v as string[]),
                      })
                    }
                    renderInput={(p) => (
                      <TextField
                        {...p}
                        size="small"
                        placeholder={claudeCode ? 'Other tools' : 'Type a tool name, then Enter'}
                        inputProps={{ ...p.inputProps, 'aria-label': 'Tools' }}
                      />
                    )}
                  />
                )}
              </Box>
              <Stack direction={{ xs: 'column', md: 'row' }} gap="16px">
                <TextField
                  select
                  label="Policy"
                  value={form.policy}
                  onChange={(e) => set({ policy: e.target.value as AgentForm['policy'] })}
                  size="small"
                  sx={{ flex: 1 }}
                  helperText={
                    form.policy === 'read-only'
                      ? 'No writes outside /workspace, and no shell command that changes something (git push, kubectl apply…).'
                      : 'May write anywhere in its sandbox and run any command its tools allow.'
                  }
                >
                  <MenuItem value="read-only">read-only</MenuItem>
                  <MenuItem value="read-write">read-write</MenuItem>
                </TextField>
                <TextField
                  label="Max turns"
                  value={form.maxTurns}
                  onChange={(e) => set({ maxTurns: e.target.value })}
                  size="small"
                  sx={{ width: { md: 140 } }}
                  error={!!show('maxTurns')}
                  helperText={show('maxTurns') ?? 'Model turns per run.'}
                  inputProps={{ inputMode: 'numeric' }}
                />
              </Stack>
              <TextField
                label="Denied commands"
                value={form.deny}
                onChange={(e) => set({ deny: e.target.value })}
                multiline
                minRows={2}
                size="small"
                placeholder={'rm -rf\ncurl .*\\|\\s*sh'}
                error={!!show('deny')}
                helperText={
                  show('deny') ??
                  'One regular expression per line. The runner refuses a shell command that matches one, and the run shows it as denied.'
                }
                InputProps={MONO_INPUT}
              />
              <ResourceInputs
                value={form}
                onChange={set}
                defaults={AGENT_DEFAULT_RESOURCES}
                errors={{
                  cpu: show('cpu'),
                  memoryMib: show('memoryMib'),
                  cpuLimit: show('cpuLimit'),
                  memoryLimitMib: show('memoryLimitMib'),
                }}
                extra={
                  <TextField
                    label="Time limit, seconds"
                    value={form.timeoutS}
                    onChange={(e) => set({ timeoutS: e.target.value })}
                    size="small"
                    fullWidth
                    error={!!show('timeoutS')}
                    helperText={show('timeoutS') ?? 'The run stops after this; the sandbox lives 2 minutes more.'}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ inputMode: 'numeric' }}
                  />
                }
              />
            </Stack>
          </Section>

          <Section title="Network access">
            <Typography sx={{ ...text.secondary, marginTop: '-6px', marginBottom: '12px' }}>
              Nothing is allowed by default. Each run’s sandbox reaches only these hosts, with these methods and paths,
              plus the model’s host. A rule can name a credential, picked from the bucket or added here: the egress
              proxy adds it to the requests the rule allows, but only on hosts it is bound to.
            </Typography>
            <Stack spacing="10px">
              {form.rules.map((r, i) => (
                <RuleRow
                  key={i}
                  rule={r}
                  error={attempted || r.host.trim() ? errors.rules?.[i] : undefined}
                  coverage={coverage.rules[i]}
                  secrets={creds}
                  onChange={(patch) => setRule(i, patch)}
                  onRemove={() => set({ rules: form.rules.filter((_, j) => j !== i) })}
                />
              ))}
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap="10px"
                sx={{ border: `1px dashed ${color.border}`, borderRadius: '12px', padding: '10px 14px' }}
              >
                <Box minWidth={0}>
                  <Box component="span" sx={{ fontFamily: mono, fontSize: 12.5, fontWeight: 600 }}>
                    {modelHost(form.baseUrl) || 'the model host'}
                    {(() => {
                      try {
                        return new URL(form.baseUrl).pathname.replace(/\/+$/, '');
                      } catch {
                        return '';
                      }
                    })()}
                  </Box>
                  <Box component="span" sx={{ ...text.caption, marginLeft: '6px' }}>
                    GET, POST · the model, added by every run
                  </Box>
                </Box>
                <CredentialChip name={form.modelCredential || null} />
              </Stack>
            </Stack>
            <Button
              size="small"
              variant="text"
              sx={{ marginTop: '8px' }}
              onClick={() => set({ rules: [...form.rules, emptyRule()] })}
            >
              Allow a host
            </Button>
            {secrets.error && !secrets.data && (
              <Box marginTop="8px">
                <ReadError what="your secrets, so credentials can’t be checked" error={secrets.error} />
              </Box>
            )}
          </Section>
        </Stack>

        <Box sx={{ position: { lg: 'sticky' }, top: { lg: 16 } }}>
          <Stack gap="16px">
            <Section title={editing ? 'Save changes' : 'Save'}>
              <Stack spacing="14px">
                <StorageBucketField choice={choice} fixed={editing?.bucket} />
                {replaces && (
                  <Alert severity="info">
                    {bucket} already has a definition named {def!.name}: saving replaces it.
                  </Alert>
                )}
                {blocking > 0 && (
                  <Alert severity="warning">
                    {blocking === 1 ? 'One credential' : `${blocking} credentials`} would stop a run (see the warnings).
                    You can save now and add or store them again from the rules above before you run it.
                  </Alert>
                )}
                {attempted && !def && (
                  <Alert severity="error">
                    Fix the fields marked in red.
                    {errors.other?.map((e) => <div key={e}>{e}</div>)}
                  </Alert>
                )}
                {error && <Alert severity="error">Couldn’t save: {error}</Alert>}
                <LoadingButton
                  variant="contained"
                  loading={busy}
                  disabled={!canSign || !bucket}
                  onClick={save}
                  title={!canSign ? NO_WALLET_HERE : undefined}
                >
                  {editing ? 'Save changes' : 'Save to bucket'}
                </LoadingButton>
                <Button
                  variant="text"
                  color="secondary"
                  component={NavLink}
                  to={editing ? agentPath(editing.bucket, editing.name) : AGENTS_PATH}
                >
                  Cancel
                </Button>
              </Stack>
            </Section>
            <Section title="What is saved">
              <Typography sx={{ ...text.caption, marginTop: '-6px', marginBottom: '10px' }}>
                <Mono>
                  {bucket ? `${bucket}/` : ''}
                  {agentKey(draft.name || '<name>')}
                </Mono>
                , the same JSON <Mono>cere agent push</Mono> and Import JSON write.
              </Typography>
              <Box sx={{ maxHeight: 520, overflow: 'auto', borderRadius: '10px' }}>
                <CodeBlock code={JSON.stringify(draft, null, 2)} />
              </Box>
            </Section>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
};

const AgentEditorObserver = observer(AgentEditor);

/** Keyed by the definition, so moving between forms starts fresh. */
const AgentEditorRoute = () => {
  const { bucket, name } = useParams<{ bucket: string; name: string }>();
  return <AgentEditorObserver key={bucket && name ? `${bucket}/${name}` : 'new'} />;
};

export default AgentEditorRoute;
