import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  IconButton,
  LoadingButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@cluster-apps/ui';
import { Autocomplete, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';

import { useCompute, useComputeClient } from '~/compute/ComputeProvider';
import { errorMessage } from '~/compute/client';
import { useSecrets } from '~/compute/hooks';
import { LABEL } from '~/compute/agentRun';
import { credentialsFor, ownSecretsFromForms, RESOLUTION_NOTE, type OwnSecretForm } from '~/compute/credentials';
import { rulesBlocked } from '~/compute/egressCoverage';
import { fmtDateTime } from '~/compute/format';
import { rulesFromForms, type RuleForm } from '~/compute/egressRules';
import { EMPTY_RESOURCE_FIELDS, parseResources, SANDBOX_DEFAULTS, type ResourceFields } from '~/compute/resources';
import type { CreateSandboxRequest } from '~/compute/types';
import { color, mono, text } from '~/theme/tokens';
import { parseKeyValues, splitCommand } from './commandLine';
import OwnSecretsEditor from './credentials/OwnSecretsEditor';
import RulesEditor from './egress/RulesEditor';
import ResourceInputs from './ResourceInputs';

const IMAGES = ['python:3.12-slim', 'node:22-slim', 'debian:bookworm-slim', 'alpine:3.20'];
const TIMEOUTS = [
  { s: 600, label: '10 minutes' },
  { s: 1800, label: '30 minutes' },
  { s: 3600, label: '1 hour' },
  { s: 86400, label: '24 hours' },
];
const IDLE = [
  { s: 0, label: 'Never' },
  { s: 300, label: 'After 5 idle minutes' },
  { s: 1800, label: 'After 30 idle minutes' },
];
/**
 * New sandbox: the create request as a form: image, command, CPU and memory
 * (the request, and the limits behind "Limits"; empty fields get the
 * cluster's defaults and are left out of the request, as the CLI does),
 * timeouts, environment, labels and the egress allow list, each rule with a
 * credential picked from the bucket or stored here, bound to the rule's host.
 */
const NewSandboxBody = ({ onClose }: { onClose: () => void }) => {
  const client = useComputeClient();
  const { tokenExpiresAt } = useCompute();
  const secrets = useSecrets();
  const navigate = useNavigate();
  const [image, setImage] = useState(IMAGES[0]);
  const [command, setCommand] = useState('sleep infinity');
  const [resourceFields, setResourceFields] = useState<ResourceFields>(EMPTY_RESOURCE_FIELDS);
  const [timeout, setTimeoutS] = useState(600);
  const [idle, setIdle] = useState(0);
  const [env, setEnv] = useState('');
  const [labels, setLabels] = useState('');
  const [rules, setRules] = useState<RuleForm[]>([]);
  const [own, setOwn] = useState<OwnSecretForm[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resources = parseResources(resourceFields);
  const cmd = splitCommand(command);
  const envKv = parseKeyValues(env);
  const labelKv = parseKeyValues(labels);
  const egress = rulesFromForms(rules.filter((r) => r.host.trim() || r.credential || r.placeholders));
  const ownSecrets = ownSecretsFromForms(own);
  // A rule's credential resolves in this sandbox's own, then its agent's (a `cere.agent` label), then the bucket's.
  const creds = credentialsFor(secrets.data, {
    own: ownSecrets.secrets.filter((x) => x.name),
    agent: labelKv.values[LABEL.agent],
  });
  const credentialProblem = rulesBlocked(egress.allow, creds);
  const formError =
    cmd.error ??
    envKv.error ??
    labelKv.error ??
    (image.trim() ? null : 'An image is required.') ??
    (Object.keys(resources.errors).length ? 'Fix CPU and memory first.' : null) ??
    (egress.ok ? null : 'Fix the network rules first.') ??
    (ownSecrets.ok ? null : 'Fix this sandbox’s credentials first.') ??
    (credentialProblem ? 'A rule’s credential can’t be sent to its host: store it again with that host.' : null);

  const request = (): CreateSandboxRequest => ({
    image: image.trim(),
    ...(cmd.args.length ? { command: cmd.args } : {}),
    runtime: 'gvisor',
    ...(Object.keys(resources.resources).length ? { resources: resources.resources } : {}),
    timeout_s: timeout,
    idle_timeout_s: idle,
    ...(Object.keys(envKv.values).length ? { env: envKv.values } : {}),
    ...(Object.keys(labelKv.values).length ? { labels: labelKv.values } : {}),
    egress: { allow: egress.allow },
    ...(ownSecrets.secrets.length ? { secrets: ownSecrets.secrets } : {}),
  });

  const create = async () => {
    setAttempted(true);
    if (formError) return;
    setBusy(true);
    setError(null);
    try {
      const sb = await client.createSandbox(request());
      // The values were only ever in this form: drop them now that the egress proxy holds them.
      setOwn([]);
      onClose();
      navigate(`/sandboxes/list/${sb.id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DialogContent dividers sx={{ padding: '20px 24px' }}>
        <Stack spacing="18px">
          <Autocomplete
            freeSolo
            options={IMAGES}
            value={image}
            onInputChange={(_, v) => setImage(v)}
            renderInput={(p) => (
              <TextField
                {...p}
                label="Image"
                size="small"
                helperText="Any public registry image."
                InputProps={{ ...p.InputProps, sx: { fontFamily: mono, fontSize: 13 } }}
              />
            )}
          />
          <TextField
            label="Command"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            size="small"
            fullWidth
            error={!!cmd.error}
            helperText={cmd.error ?? 'The main process. Quote arguments that contain spaces.'}
            InputProps={{ sx: { fontFamily: mono, fontSize: 13 } }}
          />
          <ResourceInputs
            value={resourceFields}
            onChange={(patch) => setResourceFields((f) => ({ ...f, ...patch }))}
            defaults={SANDBOX_DEFAULTS}
            // Only a typed field can be wrong, so its problem shows as it is typed (a limit below its request too).
            errors={resources.errors}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              select
              label="Stops after"
              value={String(timeout)}
              onChange={(e) => setTimeoutS(Number(e.target.value))}
              helperText={
                // The node ends a sandbox 60 s before the token it was created with expires (token_expiry).
                tokenExpiresAt !== null && Date.now() + timeout * 1000 > tokenExpiresAt - 60_000
                  ? `Or at ${fmtDateTime(tokenExpiresAt - 60_000)}, 60 s before this page’s access token expires.`
                  : undefined
              }
              size="small"
              fullWidth
            >
              {TIMEOUTS.map((t) => (
                <MenuItem key={t.s} value={String(t.s)}>
                  {t.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Stops when idle"
              value={String(idle)}
              onChange={(e) => setIdle(Number(e.target.value))}
              size="small"
              fullWidth
            >
              {IDLE.map((t) => (
                <MenuItem key={t.s} value={String(t.s)}>
                  {t.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Environment"
              value={env}
              onChange={(e) => setEnv(e.target.value)}
              size="small"
              fullWidth
              multiline
              minRows={2}
              placeholder="KEY=value"
              error={!!envKv.error}
              helperText={
                envKv.error ??
                'One KEY=value per line. Not for secrets: add a credential and name it in an egress rule.'
              }
              InputProps={{ sx: { fontFamily: mono, fontSize: 13 } }}
            />
            <TextField
              label="Labels"
              value={labels}
              onChange={(e) => setLabels(e.target.value)}
              size="small"
              fullWidth
              multiline
              minRows={2}
              placeholder="app=demo"
              error={!!labelKv.error}
              helperText={labelKv.error ?? 'One key=value per line; filter by them in the API.'}
              InputProps={{ sx: { fontFamily: mono, fontSize: 13 } }}
            />
          </Stack>

          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Network access</Typography>
            <Typography sx={{ ...text.secondary, marginBottom: '10px' }}>
              None by default. The egress proxy allows only the hosts and methods listed here and refuses the rest; you
              can change them while the sandbox runs. Pick or add a credential to have the proxy add it to a rule’s
              requests: it is bound to its hosts, and the sandbox never sees its value.
            </Typography>
            <RulesEditor rules={rules} onChange={setRules} secrets={creds} showErrors={attempted} empty={null} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Credentials for this sandbox only</Typography>
            <Typography sx={{ ...text.secondary, marginBottom: '10px' }}>
              For a token that belongs to this sandbox alone, one person’s for example. The egress proxy holds it for
              this sandbox and drops it when the sandbox ends; nobody can read it back. Rules above can name it, and a
              running sandbox’s value can be replaced from its page. {RESOLUTION_NOTE}
            </Typography>
            <OwnSecretsEditor value={own} onChange={setOwn} errors={ownSecrets.errors} showErrors={attempted} />
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ padding: '14px 24px', justifyContent: 'space-between' }}>
        <Typography sx={{ ...text.caption, color: color.textTertiary }}>
          <Box component="span" sx={{ fontFamily: mono }}>
            POST /v1/sandboxes
          </Box>
        </Typography>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {attempted && formError && <Typography sx={{ ...text.caption, color: color.danger }}>{formError}</Typography>}
          <Button variant="outlined" color="secondary" onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton variant="contained" loading={busy} disabled={!!formError && attempted} onClick={create}>
            Create sandbox
          </LoadingButton>
        </Stack>
      </DialogActions>
    </>
  );
};

export const NewSandboxDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => (
  <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
    <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      New sandbox
      <IconButton aria-label="Close" onClick={onClose} size="small">
        <CloseIcon fontSize="small" />
      </IconButton>
    </DialogTitle>
    {open && <NewSandboxBody onClose={onClose} />}
  </Dialog>
);
