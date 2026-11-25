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
import { coverageBlocks, credentialCoverage } from '~/compute/egressCoverage';
import { fmtDateTime } from '~/compute/format';
import { rulesFromForms, type RuleForm } from '~/compute/egressRules';
import type { CreateSandboxRequest } from '~/compute/types';
import { color, mono, text } from '~/theme/tokens';
import { parseKeyValues, splitCommand } from './commandLine';
import RulesEditor from './egress/RulesEditor';

const IMAGES = ['python:3.12-slim', 'node:22-slim', 'debian:bookworm-slim', 'alpine:3.20'];
const CPUS = [0.25, 0.5, 1, 2, 4];
const MEMORY = [256, 512, 1024, 2048, 4096, 8192];
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
 * New sandbox: the create request as a form: image, command, resources,
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
  const [cpu, setCpu] = useState(1);
  const [memory, setMemory] = useState(1024);
  const [timeout, setTimeoutS] = useState(600);
  const [idle, setIdle] = useState(0);
  const [env, setEnv] = useState('');
  const [labels, setLabels] = useState('');
  const [rules, setRules] = useState<RuleForm[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cmd = splitCommand(command);
  const envKv = parseKeyValues(env);
  const labelKv = parseKeyValues(labels);
  const egress = rulesFromForms(rules.filter((r) => r.host.trim() || r.credential));
  const credentialProblem = egress.allow.some((r) =>
    coverageBlocks(credentialCoverage(r.credential, r.host, secrets.data)),
  );
  const formError =
    cmd.error ??
    envKv.error ??
    labelKv.error ??
    (image.trim() ? null : 'An image is required.') ??
    (egress.ok ? null : 'Fix the network rules first.') ??
    (credentialProblem ? 'A rule’s credential can’t be sent to its host: store it again with that host.' : null);

  const request = (): CreateSandboxRequest => ({
    image: image.trim(),
    ...(cmd.args.length ? { command: cmd.args } : {}),
    runtime: 'gvisor',
    resources: { cpu, memory_mib: memory },
    timeout_s: timeout,
    idle_timeout_s: idle,
    ...(Object.keys(envKv.values).length ? { env: envKv.values } : {}),
    ...(Object.keys(labelKv.values).length ? { labels: labelKv.values } : {}),
    egress: { allow: egress.allow },
  });

  const create = async () => {
    setAttempted(true);
    if (formError) return;
    setBusy(true);
    setError(null);
    try {
      const sb = await client.createSandbox(request());
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
          <Stack direction="row" spacing={2}>
            <TextField
              select
              label="CPU"
              value={String(cpu)}
              onChange={(e) => setCpu(Number(e.target.value))}
              size="small"
              fullWidth
            >
              {CPUS.map((c) => (
                <MenuItem key={c} value={String(c)}>
                  {c} vCPU
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Memory"
              value={String(memory)}
              onChange={(e) => setMemory(Number(e.target.value))}
              size="small"
              fullWidth
            >
              {MEMORY.map((m) => (
                <MenuItem key={m} value={String(m)}>
                  {m >= 1024 ? `${m / 1024} GiB` : `${m} MiB`}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
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
              helperText={envKv.error ?? 'One KEY=value per line. Not for secrets: use Secrets and an egress rule.'}
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
              requests: it is kept for the bucket, bound to its hosts, and the sandbox never sees its value.
            </Typography>
            <RulesEditor rules={rules} onChange={setRules} secrets={secrets.data} showErrors={attempted} empty={null} />
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
