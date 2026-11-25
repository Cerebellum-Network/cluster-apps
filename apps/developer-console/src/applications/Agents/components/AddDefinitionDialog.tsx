import { ChangeEvent, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Alert, Box, Button, LoadingButton, MenuItem, Stack, TextField, Typography } from '@cluster-apps/ui';
import { Dialog, DialogActions, DialogContent, DialogTitle, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import { useAccount } from '~/hooks';
import { agentKey, parseAgentDefinition } from '~/compute/agentDefinition';
import { saveAgent, type StoredAgent } from '~/compute/agentStore';
import { errorMessage } from '~/compute/client';
import { mono, text } from '~/theme/tokens';

/**
 * Put a `cere.agent/v1` definition in one of the wallet's buckets, at
 * `cere/agents/<name>.json`, the same place `cere agent push` writes it.
 */
const AddDefinitionDialog = ({
  existing,
  onClose,
}: {
  existing: StoredAgent[];
  onClose: (saved?: { bucket: string; name: string }) => void;
}) => {
  const account = useAccount();
  const buckets = account.buckets?.map((b) => b.name) ?? [];
  const [bucket, setBucket] = useState(buckets[0] ?? '');
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const parsed = source.trim() ? parseAgentDefinition(source) : null;
  const replaces = parsed?.def && existing.some((a) => a.bucket === bucket && a.key === agentKey(parsed.def!.name));

  const load = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) setSource(await f.text());
  };

  const createBucket = async () => {
    setCreating(true);
    setError(null);
    try {
      const name = await account.createBucket();
      setBucket(name);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  const save = async () => {
    if (!parsed?.def || !bucket) return;
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
        Add an agent definition
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
              gh release download cli/v0.1.0 -R Cerebellum-Network/ddc-node -p &apos;*.json&apos;
            </Box>
            .
          </Typography>
          {buckets.length ? (
            <TextField
              select
              label="Bucket"
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              size="small"
              helperText="Saved at cere/agents/<name>.json in this bucket."
            >
              {buckets.map((b) => (
                <MenuItem key={b} value={b}>
                  <Box component="span" sx={{ fontFamily: mono, fontSize: 13 }}>
                    {b}
                  </Box>
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <Alert
              severity="info"
              action={
                <LoadingButton size="small" loading={creating} onClick={createBucket}>
                  Create one
                </LoadingButton>
              }
            >
              You have no storage bucket yet. Definitions are kept in one.
            </Alert>
          )}
          <Stack direction="row" gap="8px" alignItems="center">
            <input ref={picker} type="file" accept="application/json,.json" hidden onChange={load} />
            <Button variant="outlined" color="secondary" onClick={() => picker.current?.click()}>
              Choose a file
            </Button>
            <Typography sx={text.secondary}>or paste it below.</Typography>
          </Stack>
          <TextField
            value={source}
            onChange={(e) => setSource(e.target.value)}
            multiline
            minRows={12}
            maxRows={22}
            placeholder={'{\n  "schema": "cere.agent/v1",\n  "name": "research",\n  …\n}'}
            InputProps={{ sx: { fontFamily: mono, fontSize: 12.5 } }}
          />
          {parsed && parsed.errors.length > 0 && (
            <Alert severity="warning">
              {parsed.errors.map((e) => (
                <div key={e}>{e}</div>
              ))}
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
        <LoadingButton variant="contained" loading={busy} disabled={!parsed?.def || !bucket} onClick={save}>
          Save to bucket
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};

export default observer(AddDefinitionDialog);
