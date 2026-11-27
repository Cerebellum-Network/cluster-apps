import { useState } from 'react';
import { Alert, Button, LoadingButton, Stack, TextField, Typography } from '@cluster-apps/ui';
import { Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';

import { useComputeClient } from '~/compute/ComputeProvider';
import { errorMessage } from '~/compute/client';
import { fmtLimit } from '~/compute/format';
import { parseRetainPaths } from '~/compute/lifecycle';
import type { Sandbox } from '~/compute/types';
import { mono, text } from '~/theme/tokens';

const REASON_MAX = 120;

/** How long kept files stay when `retain` gave no `ttl_s`: 24 hours (`RETAIN_TTL`). */
const DEFAULT_RETAIN_TTL_S = 86400;

/**
 * Terminate: `DELETE /v1/sandboxes/{id}?retain=…&reason=…`. The paths given
 * here add to those it was created to keep (64 MiB in all), and stay readable
 * from the Files tab until `retained_until`.
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
  const { paths, error: bad } = parseRetainPaths(retain);
  const ttl = fmtLimit(sb.retain?.ttl_s ?? DEFAULT_RETAIN_TTL_S);

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
            It stops at once and its last minute of usage is recorded. The files you list
            {sb.retain ? ', and those it was created to keep,' : ''} stay readable for {ttl} after it ends.
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
              bad ??
              `Absolute paths of files or directories, one per line or comma-separated; 64 MiB in all.${
                sb.retain ? '' : ' Copying them out of the running sandbox needs sh and tar in its image.'
              }`
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
