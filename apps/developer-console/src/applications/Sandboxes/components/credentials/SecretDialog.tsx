import { useState } from 'react';
import { Alert, Button, LoadingButton, Stack, TextField, Typography } from '@cluster-apps/ui';
import {
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import { useComputeClient } from '~/compute/ComputeProvider';
import { errorMessage } from '~/compute/client';
import { notifySecretsChanged } from '~/compute/hooks';
import { parseHosts, SECRET_HOST_RE, SECRET_NAME_RE } from '~/compute/types';
import { mono, text } from '~/theme/tokens';

const VALUE_MAX = 8 * 1024;

export interface SecretDialogProps {
  /** Replace this secret (its name is fixed); without it, a new one. */
  name?: string;
  /** The name a new one starts with, e.g. the one a rule or a definition names. */
  suggested?: string;
  /** The hosts it starts bound to: the rule's host, or the secret's own plus a new one. */
  hosts?: string[];
  header?: string;
  /** Why it is being stored, shown above the form (e.g. "for example.com on sandbox sb-…"). */
  purpose?: string;
  onClose: (saved?: string) => void;
}

/**
 * Store a credential for the bucket (`PUT /v1/secrets/{name}`): write-only,
 * sent by the egress proxy as a header, and only to the hosts it is bound to.
 * Storing again replaces both the value and the hosts, so binding it to one
 * more host means entering the value again: a token holder can never point an
 * existing value at a host of their own.
 */
const SecretDialog = ({
  name: initial,
  suggested,
  hosts: initialHosts,
  header: initialHeader,
  purpose,
  onClose,
}: SecretDialogProps) => {
  const client = useComputeClient();
  const [name, setName] = useState(initial ?? suggested ?? '');
  const [header, setHeader] = useState(initialHeader ?? 'Authorization');
  const [hostsText, setHostsText] = useState((initialHosts ?? []).join(', '));
  const hosts = parseHosts(hostsText);
  const badHost = hosts.find((h) => !SECRET_HOST_RE.test(h));
  const [bearer, setBearer] = useState(true);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const replacing = !!initial;
  const sent = bearer && header.toLowerCase() === 'authorization' ? `Bearer ${value}` : value;
  const tooLong = new TextEncoder().encode(sent).length > VALUE_MAX;
  const valid =
    SECRET_NAME_RE.test(name) &&
    /^[A-Za-z0-9-]+$/.test(header.trim()) &&
    value.length > 0 &&
    !tooLong &&
    hosts.length > 0 &&
    !badHost;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await client.putSecret(name, { type: 'header', header: header.trim(), value: sent, hosts });
      setValue('');
      notifySecretsChanged();
      onClose(name);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={() => onClose()} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {replacing ? `Store ${initial} again` : 'New credential'}
        <IconButton aria-label="Close" onClick={() => onClose()} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {purpose && <Typography sx={text.secondary}>{purpose}</Typography>}
          {replacing && (
            <Typography sx={text.secondary}>
              The value is write-only, so storing {initial} again means entering it again; the new value and hosts
              replace the old ones for every sandbox of this bucket.
            </Typography>
          )}
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase())}
            disabled={replacing}
            size="small"
            error={!!name && !SECRET_NAME_RE.test(name)}
            helperText="Lowercase letters, digits and dashes. Egress rules name it; any sandbox or agent of this bucket can reuse it."
            inputProps={{ style: { fontFamily: mono } }}
          />
          <TextField
            label="Header"
            value={header}
            onChange={(e) => setHeader(e.target.value)}
            size="small"
            helperText="The egress proxy sets this header on requests the rule allows."
          />
          <TextField
            label="Sent only to"
            value={hostsText}
            onChange={(e) => setHostsText(e.target.value)}
            size="small"
            placeholder="api.github.com"
            error={!!badHost}
            helperText={
              badHost
                ? `“${badHost}” is not a host name. Use names like api.github.com, not URLs.`
                : 'The hosts the proxy may send this value to, separated by commas: exact names, or *.example.com for one more label. A rule that names it for any other host is refused.'
            }
            inputProps={{ style: { fontFamily: mono } }}
          />
          <TextField
            label="Value"
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            size="small"
            autoComplete="new-password"
            autoFocus={replacing}
            error={tooLong}
            helperText={tooLong ? 'At most 8 KiB.' : 'Write-only: once saved, nobody can read it back, including you.'}
          />
          {header.toLowerCase() === 'authorization' && (
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
        <LoadingButton variant="contained" loading={busy} disabled={!valid} onClick={save}>
          Save credential
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};

export default SecretDialog;
