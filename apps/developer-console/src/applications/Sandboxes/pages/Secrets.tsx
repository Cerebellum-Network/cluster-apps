import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  LoadingButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@cluster-apps/ui';
import { Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import { PageHeader, Section } from '~/components';
import { useCompute, useComputeClient } from '~/compute/ComputeProvider';
import { errorMessage } from '~/compute/client';
import { useNow, useSandboxes, useSecrets } from '~/compute/hooks';
import { fmtAgo } from '~/compute/format';
import { isLive, SECRET_NAME_RE } from '~/compute/types';
import { color, mono, text } from '~/theme/tokens';
import { BucketChip, KeyGlyph, ReadError, sbColor } from '../components/ui';

const VALUE_MAX = 8 * 1024;

const SecretDialog = ({ name: initial, onClose }: { name?: string; onClose: (saved?: string) => void }) => {
  const client = useComputeClient();
  const [name, setName] = useState(initial ?? '');
  const [header, setHeader] = useState('Authorization');
  const [bearer, setBearer] = useState(true);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const replacing = !!initial;
  const sent = bearer && header.toLowerCase() === 'authorization' ? `Bearer ${value}` : value;
  const tooLong = new TextEncoder().encode(sent).length > VALUE_MAX;
  const valid = SECRET_NAME_RE.test(name) && /^[A-Za-z0-9-]+$/.test(header.trim()) && value.length > 0 && !tooLong;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await client.putSecret(name, { type: 'header', header: header.trim(), value: sent });
      setValue('');
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
        {replacing ? `Replace ${initial}` : 'Add a secret'}
        <IconButton aria-label="Close" onClick={() => onClose()} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase())}
            disabled={replacing}
            size="small"
            error={!!name && !SECRET_NAME_RE.test(name)}
            helperText="Lowercase letters, digits and dashes. Egress rules name it."
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
            label="Value"
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            size="small"
            autoComplete="new-password"
            error={tooLong}
            helperText={tooLong ? 'At most 8 KiB.' : 'Write-only: once saved, nobody can read it back, including you.'}
          />
          {header.toLowerCase() === 'authorization' && (
            <FormControlLabel
              control={<Checkbox size="small" checked={bearer} onChange={(e) => setBearer(e.target.checked)} />}
              label={<Typography sx={text.secondary}>It’s a bearer token: send it as “Bearer &lt;value&gt;”</Typography>}
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
          Save secret
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};

const DeleteDialog = ({ name, inUse, onClose }: { name: string; inUse: number; onClose: (deleted?: boolean) => void }) => {
  const client = useComputeClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await client.deleteSecret(name);
      onClose(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={() => onClose()} maxWidth="xs" fullWidth>
      <DialogTitle>Delete {name}?</DialogTitle>
      <DialogContent dividers>
        <Typography sx={text.body}>
          {inUse
            ? `${inUse} running sandbox${inUse === 1 ? ' names' : 'es name'} it. Their requests that need it will fail with 502 “credential missing”.`
            : 'No running sandbox names it.'}
        </Typography>
        {error && (
          <Alert severity="error" sx={{ marginTop: '12px' }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ padding: '14px 24px' }}>
        <Button variant="outlined" color="secondary" onClick={() => onClose()}>
          Cancel
        </Button>
        <LoadingButton variant="contained" color="error" loading={busy} onClick={go}>
          Delete
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};

/** Secrets (`/v1/secrets`): held by the egress proxy for this bucket, write-only, named by egress rules. */
const Secrets = () => {
  const { bucketId } = useCompute();
  const { data, loading, error, reload } = useSecrets();
  const sandboxes = useSandboxes({ status: 'running' });
  const now = useNow(10_000);
  const [dialog, setDialog] = useState<{ name?: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** Running sandboxes whose egress rules name each secret. */
  const usedBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sandboxes.data?.items ?? []) {
      if (!isLive(s.status)) continue;
      for (const c of new Set(s.egress.allow.map((r) => r.credential).filter(Boolean))) m.set(c!, (m.get(c!) ?? 0) + 1);
    }
    return m;
  }, [sandboxes.data]);

  return (
    <Box>
      <Box marginBottom="20px">
        <PageHeader
          title="Secrets"
          subtitle="Credentials the egress proxy adds to your sandboxes’ requests. A sandbox never sees them: its egress rule names a secret, and the proxy injects it on the way out."
          actions={
            <>
              <BucketChip bucketId={bucketId} />
              <Button variant="contained" onClick={() => setDialog({})}>
                Add secret
              </Button>
            </>
          }
        />
      </Box>

      {notice && (
        <Alert severity="success" onClose={() => setNotice(null)} sx={{ marginBottom: '16px' }}>
          {notice}
        </Alert>
      )}

      <Section flush>
        {error && !data ? (
          <Box padding="18px 22px">
            <ReadError what="your secrets" error={error} />
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Added as</TableCell>
                  <TableCell>Value</TableCell>
                  <TableCell>Used by</TableCell>
                  <TableCell>Updated</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {(data ?? []).map((s) => (
                  <TableRow key={s.name}>
                    <TableCell>
                      <Stack direction="row" alignItems="center" gap="8px" sx={{ color: sbColor.credential }}>
                        <KeyGlyph size={14} />
                        <Box component="span" sx={{ fontFamily: mono, fontSize: 13.5, fontWeight: 600, color: color.text }}>
                          {s.name}
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 13.5 }}>
                        Header{' '}
                        <Box component="span" sx={{ fontFamily: mono, fontSize: 12.5, color: color.textSecondary }}>
                          {s.header}
                        </Box>
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={text.caption}>write-only</Typography>
                    </TableCell>
                    <TableCell sx={{ fontSize: 13.5 }}>
                      {usedBy.get(s.name) ? (
                        `${usedBy.get(s.name)} running sandbox${usedBy.get(s.name) === 1 ? '' : 'es'}`
                      ) : (
                        <Box component="span" sx={{ color: color.textTertiary }}>
                          not in use
                        </Box>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: 13.5, color: color.textSecondary }} title={s.updated_at}>
                      {fmtAgo(s.updated_at, now)}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" gap="8px" justifyContent="flex-end">
                        <Button size="small" variant="outlined" color="secondary" onClick={() => setDialog({ name: s.name })}>
                          Replace value
                        </Button>
                        <Button size="small" variant="text" color="error" onClick={() => setDeleting(s.name)}>
                          Delete
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && (data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ textAlign: 'center', padding: '32px' }}>
                      <Typography sx={text.secondary}>No secrets yet. Add one, then name it in a sandbox’s egress rule.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Section>

      <Typography sx={{ ...text.caption, marginTop: '12px' }}>
        From a terminal: <Box component="span" sx={{ fontFamily: mono }}>cere secret set &lt;name&gt; --header Authorization --bearer-stdin</Box>{' '}
        reads the value from a pipe, so it never appears in your shell history.
      </Typography>

      {dialog && (
        <SecretDialog
          name={dialog.name}
          onClose={(name) => {
            setDialog(null);
            if (name) {
              setNotice(`Saved ${name}. Its value can’t be read back; replace it to change it.`);
              reload();
            }
          }}
        />
      )}
      {deleting && (
        <DeleteDialog
          name={deleting}
          inUse={usedBy.get(deleting) ?? 0}
          onClose={(deleted) => {
            if (deleted) {
              setNotice(`Deleted ${deleting}.`);
              reload();
            }
            setDeleting(null);
          }}
        />
      )}
    </Box>
  );
};

export default Secrets;
