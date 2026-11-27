import { ChangeEvent, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Alert, Box, Button, LoadingButton, Stack, TextField, Typography } from '@cluster-apps/ui';
import { Dialog, DialogActions, DialogContent, DialogTitle, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import { useAccount } from '~/hooks';
import { agentKey, parseAgentDefinition } from '~/compute/agentDefinition';
import { saveAgent, type StoredAgent } from '~/compute/agentStore';
import { errorMessage } from '~/compute/client';
import { useCanSign } from '~/compute/walletSigning';
import { mono, text } from '~/theme/tokens';
import { EXAMPLES_RELEASE } from '../examples';
import StorageBucketField, { useStorageBucket } from './StorageBucketField';

/**
 * Import a `cere.agent/v1` definition as JSON (a file or pasted text) into one
 * of the wallet's storage buckets, at `cere/agents/<name>.json`. With
 * `initial`, it edits a stored definition's JSON in place: same bucket, same
 * name.
 */
const AddDefinitionDialog = ({
  existing,
  initial,
  onClose,
}: {
  existing: StoredAgent[];
  initial?: { bucket: string; name: string; source: string };
  onClose: (saved?: { bucket: string; name: string }) => void;
}) => {
  const account = useAccount();
  const canSign = useCanSign();
  const choice = useStorageBucket();
  const bucket = initial?.bucket ?? choice.bucket;
  const [source, setSource] = useState(initial?.source ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const parsed = source.trim() ? parseAgentDefinition(source) : null;
  const renamed = !!initial && !!parsed?.def && parsed.def.name !== initial.name;
  const replaces =
    !initial && parsed?.def && existing.some((a) => a.bucket === bucket && a.key === agentKey(parsed.def!.name));

  const load = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) setSource(await f.text());
  };

  const save = async () => {
    if (!parsed?.def || !bucket || renamed) return;
    setBusy(true);
    setError(null);
    try {
      await saveAgent(account.storage, bucket, parsed.def);
      onClose({ bucket, name: parsed.def.name });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={() => onClose()} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {initial ? `Edit ${initial.name} as JSON` : 'Import a definition as JSON'}
        <IconButton aria-label="Close" onClick={() => onClose()} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography sx={text.secondary}>
            A definition is a{' '}
            <Box component="span" sx={{ fontFamily: mono }}>
              cere.agent/v1
            </Box>{' '}
            JSON document. The examples are assets of the CLI’s release:{' '}
            <Box component="span" sx={{ fontFamily: mono }}>
              gh release download {EXAMPLES_RELEASE} -R Cerebellum-Network/ddc-node -p &apos;*.json&apos;
            </Box>
            .
          </Typography>
          <StorageBucketField choice={choice} fixed={initial?.bucket} />
          {!initial && (
            <Stack direction="row" gap="8px" alignItems="center">
              <input ref={picker} type="file" accept="application/json,.json" hidden onChange={load} />
              <Button variant="outlined" color="secondary" onClick={() => picker.current?.click()}>
                Choose a file
              </Button>
              <Typography sx={text.secondary}>or paste it below.</Typography>
            </Stack>
          )}
          <TextField
            value={source}
            onChange={(e) => setSource(e.target.value)}
            multiline
            minRows={12}
            maxRows={22}
            placeholder={'{\n  "schema": "cere.agent/v1",\n  "name": "research",\n  …\n}'}
            InputProps={{ sx: { fontFamily: mono, fontSize: 12.5 } }}
            inputProps={{ 'aria-label': 'Definition JSON' }}
          />
          {parsed && parsed.errors.length > 0 && (
            <Alert severity="warning">
              {parsed.errors.map((e) => (
                <div key={e}>{e}</div>
              ))}
            </Alert>
          )}
          {renamed && (
            <Alert severity="warning">
              The name is the file name: keep it {initial!.name}, or import the JSON as a new definition instead.
            </Alert>
          )}
          {replaces && (
            <Alert severity="info">
              This replaces the {parsed!.def!.name} definition already in {bucket}.
            </Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ padding: '14px 24px' }}>
        <Button variant="outlined" color="secondary" onClick={() => onClose()}>
          Cancel
        </Button>
        <LoadingButton
          variant="contained"
          loading={busy}
          disabled={!canSign || !parsed?.def || !bucket || renamed}
          onClick={save}
        >
          Save to bucket
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};

export default observer(AddDefinitionDialog);
