import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  LoadingButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@cluster-apps/ui';
import { Dialog, DialogActions, DialogContent, DialogTitle, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import { useComputeClient } from '~/compute/ComputeProvider';
import { errorMessage } from '~/compute/client';
import { notifySecretsChanged, useNow, useSandboxes, useSecrets } from '~/compute/hooks';
import { fmtAgo } from '~/compute/format';
import { isLive } from '~/compute/types';
import { color, mono, text } from '~/theme/tokens';
import { KeyGlyph, ReadError, sbColor } from '../ui';
import SecretDialog, { type SecretDialogProps } from './SecretDialog';

type AddOptions = Omit<SecretDialogProps, 'onClose'>;

interface CredentialDialogs {
  /** Open the credential form; resolves with the stored name, or null when it was closed without saving. */
  store: (opts?: AddOptions) => Promise<string | null>;
  /** Open the list of the bucket's credentials (replace, delete, add). */
  manage: () => void;
}

const Ctx = createContext<CredentialDialogs | null>(null);

/**
 * The credential dialogs, for every page under it: the form that stores one
 * (new, or again with more hosts) and the list of the bucket's credentials.
 * Credentials are kept per bucket so sandboxes and agents can share them;
 * pages create and pick them where a rule needs one, not on a page of their own.
 */
export function CredentialDialogProvider({ children }: { children: ReactNode }) {
  const [form, setForm] = useState<AddOptions | null>(null);
  const [managing, setManaging] = useState(false);
  const resolve = useRef<((name: string | null) => void) | null>(null);

  const store = useCallback((opts: AddOptions = {}) => {
    resolve.current?.(null);
    setForm(opts);
    return new Promise<string | null>((r) => {
      resolve.current = r;
    });
  }, []);
  const manage = useCallback(() => setManaging(true), []);
  const value = useMemo(() => ({ store, manage }), [store, manage]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {managing && <ManageCredentialsDialog onClose={() => setManaging(false)} onStore={store} />}
      {form && (
        <SecretDialog
          {...form}
          onClose={(saved) => {
            setForm(null);
            resolve.current?.(saved ?? null);
            resolve.current = null;
          }}
        />
      )}
    </Ctx.Provider>
  );
}

export function useCredentialDialogs(): CredentialDialogs {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCredentialDialogs outside CredentialDialogProvider');
  return c;
}

const DeleteConfirm = ({
  name,
  inUse,
  onClose,
}: {
  name: string;
  inUse: number;
  onClose: (deleted?: boolean) => void;
}) => {
  const client = useComputeClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await client.deleteSecret(name);
      notifySecretsChanged();
      onClose(true);
    } catch (e) {
      setError(errorMessage(e));
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
            : 'No running sandbox names it.'}{' '}
          Agent definitions that name it can’t start a run until it is stored again.
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

/** The bucket's credentials (`GET /v1/secrets`): what each is sent as, where to, and which running sandboxes name it. */
const ManageCredentialsDialog = ({
  onClose,
  onStore,
}: {
  onClose: () => void;
  onStore: (opts?: AddOptions) => Promise<string | null>;
}) => {
  const { data, error, loading } = useSecrets();
  const sandboxes = useSandboxes({ status: 'running' });
  const now = useNow(10_000);
  const [deleting, setDeleting] = useState<string | null>(null);
  const live = (sandboxes.data?.items ?? []).filter((s) => isLive(s.status));
  const usedBy = (name: string) => live.filter((s) => s.egress.allow.some((r) => r.credential === name)).length;

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Credentials in this bucket
        <IconButton aria-label="Close" onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ padding: 0 }}>
        <Typography sx={{ ...text.secondary, padding: '14px 24px 6px' }}>
          Kept by the egress proxy for the bucket, so any sandbox or agent of it can name one in an egress rule. The
          proxy adds the value to that rule’s requests, and only to the hosts it is bound to; nobody can read it back.
        </Typography>
        {error && !data ? (
          <Box padding="12px 24px 18px">
            <ReadError what="your credentials" error={error} />
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ paddingLeft: '24px' }}>Name</TableCell>
                <TableCell>Added as</TableCell>
                <TableCell>Sent only to</TableCell>
                <TableCell>Used by</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {(data ?? []).map((s) => {
                const n = usedBy(s.name);
                return (
                  <TableRow key={s.name}>
                    <TableCell sx={{ paddingLeft: '24px' }}>
                      <Stack direction="row" alignItems="center" gap="8px" sx={{ color: sbColor.credential }}>
                        <KeyGlyph />
                        <Box
                          component="span"
                          sx={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: color.text }}
                        >
                          {s.name}
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ fontSize: 13 }}>
                      Header{' '}
                      <Box component="span" sx={{ fontFamily: mono, fontSize: 12.5, color: color.textSecondary }}>
                        {s.header}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {s.hosts && s.hosts.length > 0 ? (
                        <Box component="span" sx={{ fontFamily: mono, fontSize: 12.5, color: color.textSecondary }}>
                          {s.hosts.join(', ')}
                        </Box>
                      ) : (
                        <Typography sx={{ ...text.caption, color: color.warning }}>
                          nowhere: store it again with its hosts
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: 13, color: n ? color.text : color.textTertiary }}>
                      {n ? `${n} running sandbox${n === 1 ? '' : 'es'}` : 'not in use'}
                    </TableCell>
                    <TableCell sx={{ fontSize: 13, color: color.textSecondary }} title={s.updated_at}>
                      {fmtAgo(s.updated_at, now)}
                    </TableCell>
                    <TableCell align="right" sx={{ paddingRight: '24px' }}>
                      <Stack direction="row" gap="6px" justifyContent="flex-end">
                        <Button
                          size="small"
                          variant="outlined"
                          color="secondary"
                          onClick={() => void onStore({ name: s.name, hosts: s.hosts, header: s.header })}
                        >
                          Store again
                        </Button>
                        <Button size="small" variant="text" color="error" onClick={() => setDeleting(s.name)}>
                          Delete
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && (data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ textAlign: 'center', padding: '28px' }}>
                    <Typography sx={text.secondary}>No credentials yet.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
        <Typography sx={{ ...text.caption, padding: '12px 24px 16px' }}>
          From a terminal:{' '}
          <Box component="span" sx={{ fontFamily: mono }}>
            cere secret set &lt;name&gt; --header Authorization --host &lt;host&gt; --bearer-stdin
          </Box>{' '}
          reads the value from a pipe, so it never appears in your shell history.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ padding: '14px 24px' }}>
        <Button variant="outlined" color="secondary" onClick={onClose}>
          Close
        </Button>
        <Button variant="contained" onClick={() => void onStore()}>
          New credential
        </Button>
      </DialogActions>
      {deleting && <DeleteConfirm name={deleting} inUse={usedBy(deleting)} onClose={() => setDeleting(null)} />}
    </Dialog>
  );
};
