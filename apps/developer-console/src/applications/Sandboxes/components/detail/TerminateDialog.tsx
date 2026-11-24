import { useState } from 'react';
import { Alert, Button, LoadingButton, Stack, TextField, Typography } from '@cluster-apps/ui';
import { Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';

import { useComputeClient } from '~/compute/ComputeProvider';
import { errorMessage } from '~/compute/client';
import type { Sandbox } from '~/compute/types';
import { mono, text } from '~/theme/tokens';

const REASON_MAX = 120;

/**
 * Terminate: `DELETE /v1/sandboxes/{id}?retain=…&reason=…`. Retained files
 * (each ≤ 16 MiB) stay readable from the Files tab after the sandbox ends.
 */
const TerminateDialog = ({
  sb,
  open,
  onClose,
  onDone,
}: {
  sb: Sandbox;
  open: boolean;
  onClose: () => void;
  onDone: (s: Sandbox) => void;
}) => {
  const client = useComputeClient();
  const [retain, setRetain] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paths = retain
    .split(/[\n,]/)
    .map((p) => p.trim())
    .filter(Boolean);
  const bad = paths.find((p) => !p.startsWith('/'));

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      onDone(
        await client.terminate(sb.id, { retain: paths.length ? paths : undefined, reason: reason.trim() || undefined }),
      );
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Terminate {sb.id}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography sx={text.secondary}>
            The node stops it, writes the final usage record and keeps the files you list for a week.
          </Typography>
          <TextField
            label="Keep these files"
            value={retain}
            onChange={(e) => setRetain(e.target.value)}
            multiline
            minRows={2}
            size="small"
            placeholder="/workspace/output.json"
            error={!!bad}
            helperText={
              bad
                ? `${bad} is not an absolute path.`
                : 'Absolute paths, one per line or comma-separated; each up to 16 MiB.'
            }
            InputProps={{ sx: { fontFamily: mono, fontSize: 13 } }}
          />
          <TextField
            label="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
            size="small"
            helperText={`Recorded as "terminated by API: <reason>". ${reason.length}/${REASON_MAX}`}
          />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ padding: '14px 24px' }}>
        <Button variant="outlined" color="secondary" onClick={onClose}>
          Cancel
        </Button>
        <LoadingButton variant="contained" color="error" loading={busy} disabled={!!bad} onClick={go}>
          Terminate
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};

export default TerminateDialog;
