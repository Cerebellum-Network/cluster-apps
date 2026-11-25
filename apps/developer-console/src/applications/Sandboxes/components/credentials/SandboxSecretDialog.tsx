import { useState } from 'react';
import { Alert, Box, Button, LoadingButton, Stack, TextField, Typography } from '@cluster-apps/ui';
import { Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import { useComputeClient } from '~/compute/ComputeProvider';
import { ComputeError, errorMessage } from '~/compute/client';
import type { SandboxSecret } from '~/compute/types';
import { mono, text } from '~/theme/tokens';

const VALUE_MAX = 8 * 1024;

/** What a refused replacement means, in words. */
export function sandboxSecretError(e: unknown, name: string): string {
  if (e instanceof ComputeError && e.code === 'secret_not_found')
    return `This sandbox was not created with a credential named ${name}.`;
  if (e instanceof ComputeError && e.code === 'not_running')
    return 'The sandbox has ended, and its own credentials were dropped with it.';
  if (e instanceof ComputeError && (e.status === 405 || (e.status === 404 && !e.code)))
    return 'This compute API can’t replace a running sandbox’s credential yet.';
  return errorMessage(e);
}

/**
 * A new value for one of a running sandbox's own credentials
 * (`PUT /v1/sandboxes/{id}/secrets/{name}`), for example an access token its
 * owner refreshed. The header and hosts stay as created; the sandbox's next
 * request uses the new value. Write-only: a password field, emptied once saved.
 */
const SandboxSecretDialog = ({
  sandboxId,
  secret,
  onClose,
}: {
  sandboxId: string;
  secret: SandboxSecret;
  onClose: (replaced?: boolean) => void;
}) => {
  const client = useComputeClient();
  const authorization = secret.header.toLowerCase() === 'authorization';
  const [bearer, setBearer] = useState(authorization);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sent = bearer && authorization ? `Bearer ${value}` : value;
  const tooLong = new TextEncoder().encode(sent).length > VALUE_MAX;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await client.setSandboxSecret(sandboxId, secret.name, sent);
      setValue('');
      onClose(true);
    } catch (e) {
      setError(sandboxSecretError(e, secret.name));
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={() => onClose()} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Replace {secret.name}
        <IconButton aria-label="Close" onClick={() => onClose()} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography sx={text.secondary}>
            A new value for this sandbox’s own credential, used from its next request. It is still sent as{' '}
            <Box component="span" sx={{ fontFamily: mono }}>
              {secret.header}
            </Box>, and only to{' '}
            <Box component="span" sx={{ fontFamily: mono }}>
              {secret.hosts.join(', ') || 'no host'}
            </Box>.
          </Typography>
          <TextField
            label="New value"
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            size="small"
            autoComplete="new-password"
            autoFocus
            error={tooLong}
            helperText={tooLong ? 'At most 8 KiB.' : 'Write-only: once saved, nobody can read it back, including you.'}
          />
          {authorization && (
            <FormControlLabel
              control={<Checkbox size="small" checked={bearer} onChange={(e) => setBearer(e.target.checked)} />}
              label={
                <Typography sx={text.secondary}>It’s a bearer token: send it as “Bearer &lt;value&gt;”</Typography>
              }
            />
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ padding: '14px 24px' }}>
        <Button variant="outlined" color="secondary" onClick={() => onClose()}>
          Cancel
        </Button>
        <LoadingButton variant="contained" loading={busy} disabled={!value || tooLong} onClick={save}>
          Replace value
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};

export default SandboxSecretDialog;
