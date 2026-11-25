import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Alert, Box, Button, Stack, TextField, Typography } from '@cluster-apps/ui';
import { Dialog, DialogActions, DialogContent, DialogTitle, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';

import { Pill } from '~/components';
import { useAccount } from '~/hooks';
import { AGENT_DEFAULT_RESOURCES } from '~/compute/agentDefinition';
import { modelRule } from '~/compute/agentRun';
import { agentRuns } from '~/compute/agentRuns';
import { saveRunFiles } from '~/compute/agentStore';
import { useComputeClient } from '~/compute/ComputeProvider';
import { credentialsFor } from '~/compute/credentials';
import { coverageBlocks, credentialCoverage } from '~/compute/egressCoverage';
import { fmtCpu, fmtMib } from '~/compute/format';
import { useSecrets } from '~/compute/hooks';
import { effectiveOf } from '~/compute/resources';
import { useCanSign } from '~/compute/walletSigning';
import { mono, text } from '~/theme/tokens';
import { CredentialChip, Mono } from '../../Sandboxes/components/ui';
import { Chip } from '../../Sandboxes/pages/SandboxList';
import { AGENT_EXAMPLES, EXAMPLES_RELEASE } from '../examples';
import { CoverageNote } from '../../Sandboxes/components/credentials/CredentialPicker';
import { missingSecrets, NEW_AGENT_PATH } from './definition';
import MissingSecrets from './MissingSecrets';
import { useStorageBucket } from './StorageBucketField';

/**
 * Run one of the release's example agents from the console, the same six
 * steps as `cere agent run -f <example>.json`: a real sandbox on the cluster,
 * real inference billed to your compute bucket, and the run page streaming
 * what the agent does. Nothing needs to be in a bucket first; when the wallet
 * has a storage bucket, the run's output is also copied there, as the CLI
 * does with an S3 credential.
 */
const ExampleRunDialog = ({ onClose }: { onClose: () => void }) => {
  const client = useComputeClient();
  const account = useAccount();
  const canSign = useCanSign();
  const storage = useStorageBucket();
  const secrets = useSecrets();
  const navigate = useNavigate();
  const [pick, setPick] = useState(0);
  const ex = AGENT_EXAMPLES[pick];
  const [inputs, setInputs] = useState<string[]>(() => AGENT_EXAMPLES.map((e) => e.input));
  const input = inputs[pick];
  const def = ex.def;
  const res = effectiveOf(def.resources, AGENT_DEFAULT_RESOURCES);
  const m = modelRule(def);
  const rules = [...(def.egress?.allow ?? []), m];
  const missing = missingSecrets(def, secrets.data);
  // Held, but not bound to the host the rule needs it for (e.g. a model key stored for another gateway).
  const creds = credentialsFor(secrets.data, { agent: def.name });
  const unbound = rules
    .map((r) => ({ host: r.host, c: credentialCoverage(r.credential, r.host, creds) }))
    .filter((x) => x.c.state !== 'missing' && coverageBlocks(x.c));
  const saveTo = canSign && storage.bucket ? storage.bucket : null;

  const run = () => {
    const runId = agentRuns.start({
      client,
      def,
      input: input.trim(),
      bucket: saveTo,
      save: saveTo ? (sandboxId, files) => saveRunFiles(account.storage, saveTo, sandboxId, files) : undefined,
    });
    onClose();
    navigate(`/agents/runs/${runId}`);
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Run an example agent
        <IconButton aria-label="Close" onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing="16px">
          <Stack direction="row" gap="8px" flexWrap="wrap">
            {AGENT_EXAMPLES.map((e, i) => (
              <Chip key={e.file} active={pick === i} onClick={() => setPick(i)}>
                {e.def.name}
              </Chip>
            ))}
          </Stack>
          <Box>
            <Stack direction="row" alignItems="center" gap="8px" flexWrap="wrap" marginBottom="4px">
              <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{def.name}</Typography>
              <Pill tone="primary">{def.harness}</Pill>
              <Typography sx={{ ...text.caption, fontFamily: mono }}>
                {ex.file} of {EXAMPLES_RELEASE}
              </Typography>
            </Stack>
            <Typography sx={text.secondary}>{def.description}</Typography>
            <Typography sx={{ ...text.secondary, marginTop: '4px' }}>{ex.shows}</Typography>
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' },
              gap: '6px 24px',
              ...text.secondary,
            }}
          >
            <span>
              Image <Mono>{def.image}</Mono>
            </span>
            <span>
              Model <Mono>{def.model.model}</Mono> at <Mono>{m.host}</Mono>
            </span>
            <span>
              {fmtCpu(res.cpu)} and {fmtMib(res.memoryMib)} guaranteed, up to {Math.round((def.timeout_s ?? 900) / 60)}{' '}
              min
            </span>
            <span>Tools: {(def.tools ?? []).join(', ') || 'none'}</span>
          </Box>
          <Box>
            <Typography sx={{ ...text.label, marginBottom: '6px' }}>
              The only hosts the run’s sandbox can reach
            </Typography>
            <Stack gap="4px">
              {rules.map((r, i) => (
                <Stack key={i} direction="row" alignItems="center" justifyContent="space-between" gap="10px">
                  <Box component="span" sx={{ fontFamily: mono, fontSize: 12.5 }}>
                    {r.methods.join(', ')} {r.host}
                    {r.path_prefix ?? ''}
                    {r === m && (
                      <Box component="span" sx={{ ...text.caption, marginLeft: '6px' }}>
                        the model
                      </Box>
                    )}
                  </Box>
                  <CredentialChip name={r.credential ?? null} />
                </Stack>
              ))}
            </Stack>
          </Box>
          <TextField
            label="Input"
            value={input}
            onChange={(e) => setInputs((xs) => xs.map((x, i) => (i === pick ? e.target.value : x)))}
            multiline
            minRows={3}
            fullWidth
          />
          {secrets.error && !secrets.data && (
            <Alert severity="warning">Couldn’t read your secrets ({secrets.error}), so the run may be refused.</Alert>
          )}
          {missing.length > 0 && (
            <Alert severity="warning" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
              <MissingSecrets def={def} missing={missing} onStored={secrets.reload} />
            </Alert>
          )}
          {unbound.map((u) => (
            <CoverageNote key={u.host} coverage={u.c} host={u.host} />
          ))}
          <Typography sx={text.caption}>
            Runs in a new sandbox on the cluster and bills its CPU, memory and model calls to your compute bucket. The
            output and transcript are kept on the sandbox after it ends
            {saveTo ? (
              <>
                {' '}
                and copied to <Mono>{saveTo}</Mono> at <Mono>cere/runs/&lt;sandbox id&gt;/</Mono>
              </>
            ) : null}
            .
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ padding: '14px 24px', justifyContent: 'space-between' }}>
        <Button
          variant="text"
          color="secondary"
          onClick={() => {
            onClose();
            navigate(NEW_AGENT_PATH, { state: { template: def } });
          }}
        >
          Open in the form to make your own
        </Button>
        <Stack direction="row" gap="12px">
          <Button variant="outlined" color="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={run}
            disabled={!input.trim() || (secrets.loading && !secrets.data) || missing.length > 0 || unbound.length > 0}
          >
            Run {def.name}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
};

export default observer(ExampleRunDialog);
